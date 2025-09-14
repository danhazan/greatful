"""
Algorithm Configuration System

This module contains all configurable parameters for the feed algorithm,
including scoring weights, time factors, diversity limits, and relationship bonuses.
Configuration can be overridden based on environment (dev/staging/prod).
"""

import os
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class ScoringWeights:
    """Base scoring weights for different engagement types."""
    hearts: float = 1.0
    reactions: float = 1.5
    shares: float = 4.0
    photo_bonus: float = 2.5
    daily_gratitude_bonus: float = 3.0
    unread_boost: float = 3.0  # Multiplier for unread posts (read posts get 1/unread_boost penalty)


@dataclass
class TimeFactors:
    """Time-based scoring factors and decay parameters."""
    decay_hours: int = 72  # 3-day decay
    recent_boost_1hr: float = 4.0
    recent_boost_6hr: float = 2.0
    recent_boost_24hr: float = 1.0


@dataclass
class FollowBonuses:
    """Relationship-based scoring bonuses."""
    base_multiplier: float = 5.0
    new_follow_bonus: float = 6.0
    established_follow_bonus: float = 5.0
    mutual_follow_bonus: float = 7.0
    second_tier_multiplier: float = 1.5  # Users followed by your follows
    recent_follow_days: int = 7
    recent_follow_boost: float = 1.0


@dataclass
class OwnPostFactors:
    """Factors for user's own posts visibility."""
    max_visibility_minutes: int = 5
    decay_duration_minutes: int = 15
    max_bonus_multiplier: float = 10.0
    base_multiplier: float = 2.0  # Permanent advantage for own posts


@dataclass
class DiversityLimits:
    """Limits to ensure feed diversity."""
    max_posts_per_author: int = 3
    randomization_factor: float = 0.15  # ±15%


@dataclass
class PreferenceFactors:
    """User preference and interaction-based factors."""
    interaction_threshold: int = 5
    frequent_user_boost: float = 1.0


@dataclass
class AlgorithmConfig:
    """Complete algorithm configuration."""
    scoring_weights: ScoringWeights
    time_factors: TimeFactors
    follow_bonuses: FollowBonuses
    own_post_factors: OwnPostFactors
    diversity_limits: DiversityLimits
    preference_factors: PreferenceFactors


# Default configuration
DEFAULT_CONFIG = AlgorithmConfig(
    scoring_weights=ScoringWeights(),
    time_factors=TimeFactors(),
    follow_bonuses=FollowBonuses(),
    own_post_factors=OwnPostFactors(),
    diversity_limits=DiversityLimits(),
    preference_factors=PreferenceFactors()
)

# Environment-specific overrides
ENVIRONMENT_OVERRIDES = {
    'development': {
        'scoring_weights': {
            'hearts': 1.2,  # Slightly higher for testing
            'reactions': 1.8,
            'shares': 5.0,
        },
        'time_factors': {
            'decay_hours': 48,  # Faster decay for dev testing
            'recent_boost_1hr': 5.0,
        },
        'diversity_limits': {
            'randomization_factor': 0.25,  # More randomization for testing
        }
    },
    'staging': {
        'scoring_weights': {
            'hearts': 1.1,
            'reactions': 1.6,
            'shares': 4.5,
        },
        'time_factors': {
            'decay_hours': 60,  # 2.5 days
        }
    },
    'production': {
        # Production uses default values
    }
}


class AlgorithmConfigManager:
    """Manager for algorithm configuration with environment overrides and validation."""
    
    def __init__(self, environment: Optional[str] = None):
        """
        Initialize configuration manager.
        
        Args:
            environment: Environment name (dev/staging/prod). If None, uses ENVIRONMENT env var.
        """
        self.environment = environment or os.getenv('ENVIRONMENT', 'development')
        self._config = None
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration with environment overrides."""
        try:
            # Start with default config
            config_dict = asdict(DEFAULT_CONFIG)
            
            # Apply environment overrides
            if self.environment in ENVIRONMENT_OVERRIDES:
                overrides = ENVIRONMENT_OVERRIDES[self.environment]
                config_dict = self._deep_merge(config_dict, overrides)
            
            # Validate configuration
            self._validate_config(config_dict)
            
            # Create config object
            self._config = AlgorithmConfig(
                scoring_weights=ScoringWeights(**config_dict['scoring_weights']),
                time_factors=TimeFactors(**config_dict['time_factors']),
                follow_bonuses=FollowBonuses(**config_dict['follow_bonuses']),
                own_post_factors=OwnPostFactors(**config_dict['own_post_factors']),
                diversity_limits=DiversityLimits(**config_dict['diversity_limits']),
                preference_factors=PreferenceFactors(**config_dict['preference_factors'])
            )
            
            logger.info(f"Algorithm configuration loaded for environment: {self.environment}")
            
        except Exception as e:
            logger.error(f"Failed to load algorithm configuration: {e}")
            logger.warning("Falling back to default configuration")
            self._config = DEFAULT_CONFIG
    
    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two dictionaries."""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _validate_config(self, config_dict: Dict[str, Any]) -> None:
        """Validate configuration values."""
        # Validate scoring weights are positive
        scoring = config_dict.get('scoring_weights', {})
        for key, value in scoring.items():
            if not isinstance(value, (int, float)) or value < 0:
                raise ValueError(f"Scoring weight '{key}' must be a positive number, got: {value}")
        
        # Validate time factors
        time_factors = config_dict.get('time_factors', {})
        if 'decay_hours' in time_factors and time_factors['decay_hours'] <= 0:
            raise ValueError("decay_hours must be positive")
        
        # Validate diversity limits
        diversity = config_dict.get('diversity_limits', {})
        if 'max_posts_per_author' in diversity and diversity['max_posts_per_author'] <= 0:
            raise ValueError("max_posts_per_author must be positive")
        
        if 'randomization_factor' in diversity:
            factor = diversity['randomization_factor']
            if not 0 <= factor <= 1:
                raise ValueError("randomization_factor must be between 0 and 1")
        
        # Validate follow bonuses are positive
        follow_bonuses = config_dict.get('follow_bonuses', {})
        for key, value in follow_bonuses.items():
            if key.endswith('_multiplier') or key.endswith('_bonus'):
                if not isinstance(value, (int, float)) or value < 0:
                    raise ValueError(f"Follow bonus '{key}' must be positive, got: {value}")
    
    @property
    def config(self) -> AlgorithmConfig:
        """Get the current configuration."""
        return self._config
    
    def get_scoring_weights(self) -> ScoringWeights:
        """Get scoring weights configuration."""
        return self._config.scoring_weights
    
    def get_time_factors(self) -> TimeFactors:
        """Get time factors configuration."""
        return self._config.time_factors
    
    def get_follow_bonuses(self) -> FollowBonuses:
        """Get follow bonuses configuration."""
        return self._config.follow_bonuses
    
    def get_own_post_factors(self) -> OwnPostFactors:
        """Get own post factors configuration."""
        return self._config.own_post_factors
    
    def get_diversity_limits(self) -> DiversityLimits:
        """Get diversity limits configuration."""
        return self._config.diversity_limits
    
    def get_preference_factors(self) -> PreferenceFactors:
        """Get preference factors configuration."""
        return self._config.preference_factors
    
    def reload_config(self) -> None:
        """Reload configuration (useful for testing or config updates)."""
        self._load_config()
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration for debugging."""
        return {
            'environment': self.environment,
            'config': asdict(self._config)
        }


# Global configuration manager instance
_config_manager = None


def get_algorithm_config() -> AlgorithmConfig:
    """
    Get the global algorithm configuration.
    
    Returns:
        AlgorithmConfig: Current algorithm configuration
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = AlgorithmConfigManager()
    return _config_manager.config


def get_config_manager() -> AlgorithmConfigManager:
    """
    Get the global configuration manager.
    
    Returns:
        AlgorithmConfigManager: Configuration manager instance
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = AlgorithmConfigManager()
    return _config_manager


def reload_algorithm_config() -> None:
    """Reload the algorithm configuration (useful for testing)."""
    global _config_manager
    if _config_manager is not None:
        _config_manager.reload_config()


# Convenience functions for accessing specific config sections
def get_scoring_weights() -> ScoringWeights:
    """Get scoring weights configuration."""
    return get_algorithm_config().scoring_weights


def get_time_factors() -> TimeFactors:
    """Get time factors configuration."""
    return get_algorithm_config().time_factors


def get_follow_bonuses() -> FollowBonuses:
    """Get follow bonuses configuration."""
    return get_algorithm_config().follow_bonuses


def get_own_post_factors() -> OwnPostFactors:
    """Get own post factors configuration."""
    return get_algorithm_config().own_post_factors


def get_diversity_limits() -> DiversityLimits:
    """Get diversity limits configuration."""
    return get_algorithm_config().diversity_limits


def get_preference_factors() -> PreferenceFactors:
    """Get preference factors configuration."""
    return get_algorithm_config().preference_factors