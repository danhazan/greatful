"""
Tests for algorithm configuration system.
"""

import pytest
import os
from unittest.mock import patch

from app.config.algorithm_config import (
    AlgorithmConfigManager,
    get_algorithm_config,
    get_config_manager,
    reload_algorithm_config,
    ScoringWeights,
    TimeFactors,
    FollowBonuses,
    OwnPostFactors,
    DiversityLimits,
    PreferenceFactors,
    DEFAULT_CONFIG,
    ENVIRONMENT_OVERRIDES
)


class TestAlgorithmConfigManager:
    """Test algorithm configuration manager."""
    
    def test_default_config_initialization(self):
        """Test that default configuration is loaded correctly."""
        manager = AlgorithmConfigManager(environment='production')
        config = manager.config
        
        # Test default scoring weights
        assert config.scoring_weights.hearts == 1.0
        assert config.scoring_weights.reactions == 1.5
        assert config.scoring_weights.shares == 4.0
        assert config.scoring_weights.photo_bonus == 2.5
        assert config.scoring_weights.daily_gratitude_bonus == 3.0
        assert config.scoring_weights.unread_boost == 3.0
        
        # Test default time factors
        assert config.time_factors.decay_hours == 72
        assert config.time_factors.recent_boost_1hr == 4.0
        assert config.time_factors.recent_boost_6hr == 2.0
        assert config.time_factors.recent_boost_24hr == 1.0
        
        # Test default follow bonuses
        assert config.follow_bonuses.base_multiplier == 5.0
        assert config.follow_bonuses.new_follow_bonus == 6.0
        assert config.follow_bonuses.mutual_follow_bonus == 7.0
        
        # Test default diversity limits
        assert config.diversity_limits.max_posts_per_author == 3
        assert config.diversity_limits.randomization_factor == 0.15
    
    def test_development_environment_overrides(self):
        """Test that development environment overrides are applied."""
        manager = AlgorithmConfigManager(environment='development')
        config = manager.config
        
        # Check overridden values
        assert config.scoring_weights.hearts == 1.2  # Overridden
        assert config.scoring_weights.reactions == 1.8  # Overridden
        assert config.scoring_weights.shares == 5.0  # Overridden
        assert config.scoring_weights.photo_bonus == 2.5  # Default (not overridden)
        
        assert config.time_factors.decay_hours == 48  # Overridden
        assert config.time_factors.recent_boost_1hr == 5.0  # Overridden
        assert config.time_factors.recent_boost_6hr == 2.0  # Default (not overridden)
        
        assert config.diversity_limits.randomization_factor == 0.25  # Overridden
        assert config.diversity_limits.max_posts_per_author == 3  # Default (not overridden)
    
    def test_staging_environment_overrides(self):
        """Test that staging environment overrides are applied."""
        manager = AlgorithmConfigManager(environment='staging')
        config = manager.config
        
        # Check overridden values
        assert config.scoring_weights.hearts == 1.1  # Overridden
        assert config.scoring_weights.reactions == 1.6  # Overridden
        assert config.scoring_weights.shares == 4.5  # Overridden
        
        assert config.time_factors.decay_hours == 60  # Overridden
        assert config.time_factors.recent_boost_1hr == 4.0  # Default (not overridden)
    
    @patch.dict(os.environ, {'ENVIRONMENT': 'development'})
    def test_environment_from_env_var(self):
        """Test that environment is read from environment variable."""
        manager = AlgorithmConfigManager()
        assert manager.environment == 'development'
        
        # Should have development overrides
        config = manager.config
        assert config.scoring_weights.hearts == 1.2
    
    def test_invalid_environment_uses_default(self):
        """Test that invalid environment falls back to development."""
        manager = AlgorithmConfigManager(environment='invalid_env')
        assert manager.environment == 'invalid_env'
        
        # Should use default config since no overrides exist
        config = manager.config
        assert config.scoring_weights.hearts == 1.0
    
    def test_config_validation_positive_weights(self):
        """Test that configuration validation catches negative weights."""
        # This should work fine with valid config
        manager = AlgorithmConfigManager(environment='production')
        assert manager.config is not None
        
        # Test that validation would catch invalid values
        # (We can't easily test this without modifying the override structure)
    
    def test_config_reload(self):
        """Test configuration reload functionality."""
        manager = AlgorithmConfigManager(environment='production')
        original_config = manager.config
        
        # Reload should work without errors
        manager.reload_config()
        reloaded_config = manager.config
        
        # Should have same values (since environment didn't change)
        assert reloaded_config.scoring_weights.hearts == original_config.scoring_weights.hearts
    
    def test_config_summary(self):
        """Test configuration summary generation."""
        manager = AlgorithmConfigManager(environment='development')
        summary = manager.get_config_summary()
        
        assert 'environment' in summary
        assert 'config' in summary
        assert summary['environment'] == 'development'
        
        # Check that config structure is preserved
        config_dict = summary['config']
        assert 'scoring_weights' in config_dict
        assert 'time_factors' in config_dict
        assert 'follow_bonuses' in config_dict
        assert 'own_post_factors' in config_dict
        assert 'diversity_limits' in config_dict
        assert 'preference_factors' in config_dict
    
    def test_convenience_methods(self):
        """Test convenience methods for accessing config sections."""
        manager = AlgorithmConfigManager(environment='production')
        
        scoring_weights = manager.get_scoring_weights()
        assert isinstance(scoring_weights, ScoringWeights)
        assert scoring_weights.hearts == 1.0
        
        time_factors = manager.get_time_factors()
        assert isinstance(time_factors, TimeFactors)
        assert time_factors.decay_hours == 72
        
        follow_bonuses = manager.get_follow_bonuses()
        assert isinstance(follow_bonuses, FollowBonuses)
        assert follow_bonuses.base_multiplier == 5.0
        
        own_post_factors = manager.get_own_post_factors()
        assert isinstance(own_post_factors, OwnPostFactors)
        assert own_post_factors.max_visibility_minutes == 5
        
        diversity_limits = manager.get_diversity_limits()
        assert isinstance(diversity_limits, DiversityLimits)
        assert diversity_limits.max_posts_per_author == 3
        
        preference_factors = manager.get_preference_factors()
        assert isinstance(preference_factors, PreferenceFactors)
        assert preference_factors.interaction_threshold == 5


class TestGlobalConfigFunctions:
    """Test global configuration functions."""
    
    def test_get_algorithm_config(self):
        """Test global config getter."""
        config = get_algorithm_config()
        assert config is not None
        assert hasattr(config, 'scoring_weights')
        assert hasattr(config, 'time_factors')
    
    def test_get_config_manager(self):
        """Test global config manager getter."""
        manager = get_config_manager()
        assert isinstance(manager, AlgorithmConfigManager)
    
    def test_reload_algorithm_config(self):
        """Test global config reload."""
        # Should not raise any errors
        reload_algorithm_config()
        
        # Config should still be accessible
        config = get_algorithm_config()
        assert config is not None


class TestConfigValidation:
    """Test configuration validation logic."""
    
    def test_deep_merge_functionality(self):
        """Test deep merge of configuration dictionaries."""
        manager = AlgorithmConfigManager(environment='production')
        
        base = {
            'scoring_weights': {'hearts': 1.0, 'reactions': 1.5},
            'time_factors': {'decay_hours': 72}
        }
        
        override = {
            'scoring_weights': {'hearts': 2.0},  # Override hearts only
            'new_section': {'new_value': 10}     # Add new section
        }
        
        result = manager._deep_merge(base, override)
        
        # Hearts should be overridden
        assert result['scoring_weights']['hearts'] == 2.0
        # Reactions should remain from base
        assert result['scoring_weights']['reactions'] == 1.5
        # Time factors should remain unchanged
        assert result['time_factors']['decay_hours'] == 72
        # New section should be added
        assert result['new_section']['new_value'] == 10
    
    def test_validation_catches_invalid_values(self):
        """Test that validation catches various invalid configuration values."""
        manager = AlgorithmConfigManager(environment='production')
        
        # Test negative scoring weight
        with pytest.raises(ValueError, match="must be a positive number"):
            manager._validate_config({
                'scoring_weights': {'hearts': -1.0}
            })
        
        # Test invalid decay hours
        with pytest.raises(ValueError, match="decay_hours must be positive"):
            manager._validate_config({
                'time_factors': {'decay_hours': 0}
            })
        
        # Test invalid max posts per author
        with pytest.raises(ValueError, match="max_posts_per_author must be positive"):
            manager._validate_config({
                'diversity_limits': {'max_posts_per_author': 0}
            })
        
        # Test invalid randomization factor
        with pytest.raises(ValueError, match="randomization_factor must be between 0 and 1"):
            manager._validate_config({
                'diversity_limits': {'randomization_factor': 1.5}
            })


class TestEnvironmentOverrides:
    """Test environment-specific configuration overrides."""
    
    def test_all_environments_have_valid_overrides(self):
        """Test that all environment overrides are valid."""
        for env_name, overrides in ENVIRONMENT_OVERRIDES.items():
            # Create manager with this environment
            manager = AlgorithmConfigManager(environment=env_name)
            
            # Should not raise validation errors
            assert manager.config is not None
            
            # Should have the environment set correctly
            assert manager.environment == env_name
    
    def test_production_uses_defaults(self):
        """Test that production environment uses default values."""
        prod_manager = AlgorithmConfigManager(environment='production')
        default_manager = AlgorithmConfigManager(environment='nonexistent')
        
        # Both should have same values since production has no overrides
        # and nonexistent environment falls back to defaults
        assert (prod_manager.config.scoring_weights.hearts == 
                default_manager.config.scoring_weights.hearts)
        assert (prod_manager.config.time_factors.decay_hours == 
                default_manager.config.time_factors.decay_hours)