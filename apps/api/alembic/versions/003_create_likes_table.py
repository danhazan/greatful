"""Create likes table for heart reactions

Revision ID: 003_create_likes
Revises: 002_add_user_profile_fields
Create Date: 2025-01-08 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_create_likes'
down_revision = '002_add_user_profile_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create likes table for heart reactions."""
    
    # Create likes table
    op.create_table(
        'likes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'post_id', name='unique_user_post_like')
    )
    
    # Create indexes for performance
    op.create_index('idx_likes_post_id', 'likes', ['post_id'])
    op.create_index('idx_likes_user_id', 'likes', ['user_id'])
    op.create_index('idx_likes_created_at', 'likes', ['created_at'])


def downgrade() -> None:
    """Drop likes table and related constraints."""
    
    # Drop indexes
    op.drop_index('idx_likes_created_at', table_name='likes')
    op.drop_index('idx_likes_user_id', table_name='likes')
    op.drop_index('idx_likes_post_id', table_name='likes')
    
    # Drop table (constraints will be dropped automatically)
    op.drop_table('likes')