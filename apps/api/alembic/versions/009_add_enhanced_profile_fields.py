"""Add enhanced profile fields to users table

Revision ID: 009_add_enhanced_profile_fields
Revises: 008_create_follows_table
Create Date: 2025-01-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '009_add_enhanced_profile_fields'
down_revision = 'dbf27ae66c7d'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to users table
    op.add_column('users', sa.Column('display_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('institutions', postgresql.JSONB(), nullable=True))
    op.add_column('users', sa.Column('websites', postgresql.JSONB(), nullable=True))
    op.add_column('users', sa.Column('profile_photo_filename', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('profile_preferences', postgresql.JSONB(), nullable=True))
    
    # Create indexes
    op.create_index('idx_users_display_name', 'users', ['display_name'])
    op.create_index('idx_users_city', 'users', ['city'])
    op.create_index('idx_users_profile_photo_filename', 'users', ['profile_photo_filename'])
    
    # Set default display_name = username for existing users
    op.execute("UPDATE users SET display_name = username WHERE display_name IS NULL")
    
    # Set default profile preferences for existing users
    default_preferences = """{
        "allow_mentions": true,
        "allow_sharing": true,
        "profile_visibility": "public",
        "show_email": false,
        "show_join_date": true,
        "show_stats": true,
        "notification_settings": {
            "email_notifications": true,
            "push_notifications": true,
            "reaction_notifications": true,
            "mention_notifications": true,
            "follow_notifications": true,
            "share_notifications": true,
            "batch_notifications": true
        }
    }"""
    op.execute(f"UPDATE users SET profile_preferences = '{default_preferences}' WHERE profile_preferences IS NULL")

def downgrade():
    # Drop indexes
    op.drop_index('idx_users_profile_photo_filename', 'users')
    op.drop_index('idx_users_city', 'users')
    op.drop_index('idx_users_display_name', 'users')
    
    # Drop columns
    op.drop_column('users', 'profile_preferences')
    op.drop_column('users', 'profile_photo_filename')
    op.drop_column('users', 'websites')
    op.drop_column('users', 'institutions')
    op.drop_column('users', 'city')
    op.drop_column('users', 'display_name')