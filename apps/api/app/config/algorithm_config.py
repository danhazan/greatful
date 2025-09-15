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
    photo_bonus: float = 1.5  # Reduced from 2.5 to 1.5
    daily_gratitude_bonus: float = 2.0  # Reduced from 3.0 to 2.0
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
    # Enhanced follow engagement tracking
    high_engagement_threshold: int = 5  # Minimum interactions to be considered high engagement
    high_engagement_bonus: float = 2.0  # Additional bonus for high engagement follows
    # Follow recency factors
    new_follow_threshold_days: int = 7  # Days to consider a follow "new"
    established_follow_threshold_days: int = 30  # Days to consider a follow "established"


@dataclass
class OwnPostFactors:
    """Factors for user's own posts visibility."""
    max_visibility_minutes: int = 5
    decay_duration_minutes: int = 15
    max_bonus_multiplier: float = 50.0  # Increased from 10.0 to 50.0 for stronger visibility
    base_multiplier: float = 3.0  # Increased from 2.0 to 3.0 for permanent advantage


@dataclass
class DiversityLimits:
    """Limits to ensure feed diversity."""
    max_posts_per_author: int = 3
    randomization_factor: float = 0.15  # ±15%
    # Content type balancing limits (percentage of feed)
    max_photo_posts_percentage: float = 0.4  # Max 40% photo posts
    max_daily_posts_percentage: float = 0.5  # Max 50% daily gratitude posts
    max_spontaneous_posts_percentage: float = 0.6  # Max 60% spontaneous posts
    # Feed spacing rules to prevent consecutive posts by same user
    max_consecutive_posts_per_user: int = 1  # Maximum consecutive posts by same user
    spacing_window_size: int = 5  # Window size for spacing calculation (posts)
    spacing_violation_penalty: float = 0.3  # Penalty multiplier for violating posts


@dataclass
class PreferenceFactors:
    """User preference and interaction-based factors."""
    interaction_threshold: int = 2  # Minimum interactions to be considered "frequent"
    frequent_user_boost: float = 3.0  # Boost for frequently interacted users
    # Interaction scoring thresholds
    heart_interaction_weight: float = 1.0
    reaction_interaction_weight: float = 1.5
    share_interaction_weight: float = 2.0
    mention_interaction_weight: float = 1.5
    # Preference decay (days)
    preference_decay_days: int = 30


@dataclass
class MentionBonuses:
    """Mention-based scoring bonuses."""
    direct_mention: float = 8.0  # Bonus for posts where current user is mentioned


@dataclass
class AlgorithmConfig:
    """Complete algorithm configuration."""
    scoring_weights: ScoringWeights
    time_factors: TimeFactors
    follow_bonuses: FollowBonuses
    own_post_factors: OwnPostFactors
    diversity_limits: DiversityLimits
    preference_factors: PreferenceFactors
    mention_bonuses: MentionBonuses


# Default configuration
DEFAULT_CONFIG = AlgorithmConfig(
    scoring_weights=ScoringWeights(),
    time_factors=TimeFactors(),
    follow_bonuses=FollowBonuses(),
    own_post_factors=OwnPostFactors(),
    diversity_limits=DiversityLimits(),
    preference_factors=PreferenceFactors(),
    mention_bonuses=MentionBonuses()
)

# Environment-specific overrides
ENVIRONMENT_OVERRIDES = {
    'development': {
        'scoring_weights': {
            'hearts': 1.2,  # Slightly higher for testing
            'reactions': 1.8,
            'shares': 5.0,
            'photo_bonus': 1.5,  # Reduced impact
            'daily_gratitude_bonus': 2.0,  # Reduced impact
        },
        'time_factors': {
            'decay_hours': 48,  # Faster decay for dev testing
            'recent_boost_1hr': 5.0,
        },
        'own_post_factors': {
            'max_bonus_multiplier': 75.0,  # Even higher for development testing
            'base_multiplier': 4.0,  # Higher permanent advantage for dev
        },
        'diversity_limits': {
            'randomization_factor': 0.25,  # More randomization for testing
            'max_consecutive_posts_per_user': 1,  # Strict spacing rules for development
            'spacing_window_size': 4,  # Smaller window for development testing
            'spacing_violation_penalty': 0.5,  # Stronger penalty for development
        },
        'preference_factors': {
            'interaction_threshold': 1,  # Lower threshold for development
            'frequent_user_boost': 4.0,  # Higher boost for testing
        },
        'follow_bonuses': {
            'base_multiplier': 2.0,  # Reduced from 5.0 to prevent excessive bonuses
            'new_follow_bonus': 2.5,  # Reduced from 6.0 to prevent excessive bonuses
            'established_follow_bonus': 2.0,  # Reduced from 5.0
            'mutual_follow_bonus': 3.0,  # Reduced from 7.0
            'recent_follow_boost': 0.5,  # Reduced from 1.0 to prevent excessive recency bonus
            'high_engagement_threshold': 3,  # Lower threshold for development
            'high_engagement_bonus': 1.0,  # Reduced from 3.0 to prevent excessive engagement bonus
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
        },
        'diversity_limits': {
            'randomization_factor': 0.20,  # Moderate randomization for staging
            'max_consecutive_posts_per_user': 1,
            'spacing_window_size': 5,
        },
        'preference_factors': {
            'interaction_threshold': 2,  # Staging threshold
            'frequent_user_boost': 3.5,
        }
    },
    'production': {
        'scoring_weights': {
            'hearts': 1.0,  # Production-optimized values
            'reactions': 1.5,
            'shares': 4.0,
            'photo_bonus': 1.5,
            'daily_gratitude_bonus': 2.0,
            'unread_boost': 3.0,
        },
        'time_factors': {
            'decay_hours': 72,  # 3-day decay for production
            'recent_boost_1hr': 4.0,
            'recent_boost_6hr': 2.0,
            'recent_boost_24hr': 1.0,
        },
        'follow_bonuses': {
            'base_multiplier': 5.0,  # Production-optimized follow bonuses
            'new_follow_bonus': 6.0,
            'established_follow_bonus': 5.0,
            'mutual_follow_bonus': 7.0,
            'second_tier_multiplier': 1.5,
            'high_engagement_threshold': 5,
            'high_engagement_bonus': 2.0,
        },
        'own_post_factors': {
            'max_visibility_minutes': 5,
            'decay_duration_minutes': 15,
            'max_bonus_multiplier': 50.0,
            'base_multiplier': 3.0,
        },
        'diversity_limits': {
            'max_posts_per_author': 3,
            'randomization_factor': 0.15,  # Balanced randomization for production
            'max_photo_posts_percentage': 0.4,
            'max_daily_posts_percentage': 0.5,
            'max_spontaneous_posts_percentage': 0.6,
            'max_consecutive_posts_per_user': 1,
            'spacing_window_size': 5,
            'spacing_violation_penalty': 0.3,
        },
        'preference_factors': {
            'interaction_threshold': 2,  # Production threshold
            'frequent_user_boost': 3.0,
            'heart_interaction_weight': 1.0,
            'reaction_interaction_weight': 1.5,
            'share_interaction_weight': 2.0,
            'mention_interaction_weight': 1.5,
            'preference_decay_days': 30,
        },
        'mention_bonuses': {
            'direct_mention': 8.0,
        }
    }
}

# Production performance configuration
PRODUCTION_PERFORMANCE_CONFIG = {
    'cache_settings': {
        'feed_cache_ttl': 300,  # 5 minutes
        'user_preference_cache_ttl': 1800,  # 30 minutes
        'algorithm_config_cache_ttl': 3600,  # 1 hour
        'post_score_cache_ttl': 600,  # 10 minutes
    },
    'query_optimization': {
        'batch_size': 100,  # Posts to process in batches
        'max_feed_size': 50,  # Maximum posts in feed
        'prefetch_relationships': ['user', 'reactions', 'shares'],
        'use_query_hints': True,
    },
    'algorithm_tuning': {
        'score_calculation_timeout': 30,  # seconds
        'max_concurrent_calculations': 10,
        'enable_score_caching': True,
        'recalculate_scores_interval': 3600,  # 1 hour
    },
    'monitoring': {
        'track_algorithm_performance': True,
        'log_slow_calculations': True,
        'slow_calculation_threshold': 1.0,  # seconds
        'enable_metrics_collection': True,
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
        self._performance_config = None
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
                preference_factors=PreferenceFactors(**config_dict['preference_factors']),
                mention_bonuses=MentionBonuses(**config_dict['mention_bonuses'])
            )
            
            # Load performance configuration for production
            if self.environment == 'production':
                self._performance_config = PRODUCTION_PERFORMANCE_CONFIG
            else:
                self._performance_config = {}
            
            logger.info(f"Algorithm configuration loaded for environment: {self.environment}")
            
        except Exception as e:
            logger.error(f"Failed to load algorithm configuration: {e}")
            logger.warning("Falling back to default configuration")
            self._config = DEFAULT_CONFIG
            self._performance_config = {}
    
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
    
    def get_mention_bonuses(self) -> MentionBonuses:
        """Get mention bonuses configuration."""
        return self._config.mention_bonuses
    
    def reload_config(self) -> None:
        """Reload configuration (useful for testing or config updates)."""
        self._load_config()
    
    def get_performance_config(self) -> Dict[str, Any]:
        """Get performance configuration for the current environment."""
        return self._performance_config.copy()
    
    def get_cache_settings(self) -> Dict[str, Any]:
        """Get cache settings for the current environment."""
        return self._performance_config.get('cache_settings', {})
    
    def get_query_optimization_settings(self) -> Dict[str, Any]:
        """Get query optimization settings."""
        return self._performance_config.get('query_optimization', {})
    
    def get_algorithm_tuning_settings(self) -> Dict[str, Any]:
        """Get algorithm tuning settings."""
        return self._performance_config.get('algorithm_tuning', {})
    
    def get_monitoring_settings(self) -> Dict[str, Any]:
        """Get monitoring settings."""
        return self._performance_config.get('monitoring', {})
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration for debugging."""
        return {
            'environment': self.environment,
            'config': asdict(self._config),
            'performance_config': self._performance_config
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


def get_mention_bonuses() -> MentionBonuses:
    """Get mention bonuses configuration."""
    return get_algorithm_config().mention_bonuses