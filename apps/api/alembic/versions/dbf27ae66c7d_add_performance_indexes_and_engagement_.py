"""add_performance_indexes_and_engagement_columns

Revision ID: dbf27ae66c7d
Revises: 008_create_follows
Create Date: 2025-08-29 21:11:12.733658

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dbf27ae66c7d'
down_revision = '008_create_follows'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes and engagement columns to posts table."""
    
    # Add engagement count columns to posts table
    op.add_column('posts', sa.Column('hearts_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('posts', sa.Column('reactions_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('posts', sa.Column('shares_count', sa.Integer(), nullable=False, server_default='0'))
    
    # Create performance indexes for posts table
    # Index for chronological ordering (created_at DESC)
    op.create_index('idx_posts_created_at_desc', 'posts', [sa.text('created_at DESC')])
    
    # Composite index for user feeds (author_id, created_at DESC)
    op.create_index('idx_posts_author_created_desc', 'posts', ['author_id', sa.text('created_at DESC')])
    
    # Index on engagement columns for algorithm scoring
    op.create_index('idx_posts_engagement', 'posts', ['hearts_count', 'reactions_count', 'shares_count'])
    
    # Add missing indexes for follows table (these should have been created but seem to be missing)
    op.create_index('idx_follows_follower_id', 'follows', ['follower_id'])
    op.create_index('idx_follows_followed_id', 'follows', ['followed_id'])
    op.create_index('idx_follows_status', 'follows', ['status'])
    op.create_index('idx_follows_created_at', 'follows', ['created_at'])
    
    # Composite index for follow queries (follower_id, followed_id) - this improves the existing unique constraint
    op.create_index('idx_follows_follower_followed', 'follows', ['follower_id', 'followed_id'])


def downgrade() -> None:
    """Remove performance indexes and engagement columns."""
    
    # Drop indexes for follows table
    op.drop_index('idx_follows_follower_followed', table_name='follows')
    op.drop_index('idx_follows_created_at', table_name='follows')
    op.drop_index('idx_follows_status', table_name='follows')
    op.drop_index('idx_follows_followed_id', table_name='follows')
    op.drop_index('idx_follows_follower_id', table_name='follows')
    
    # Drop performance indexes for posts table
    op.drop_index('idx_posts_engagement', table_name='posts')
    op.drop_index('idx_posts_author_created_desc', table_name='posts')
    op.drop_index('idx_posts_created_at_desc', table_name='posts')
    
    # Remove engagement count columns from posts table
    op.drop_column('posts', 'shares_count')
    op.drop_column('posts', 'reactions_count')
    op.drop_column('posts', 'hearts_count')