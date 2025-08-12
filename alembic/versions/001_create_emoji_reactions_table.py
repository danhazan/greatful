"""Create emoji_reactions table

Revision ID: 001_emoji_reactions
Revises: 
Create Date: 2025-01-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_emoji_reactions'
down_revision = '000_base_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create emoji_reactions table with proper constraints and indexes."""
    
    # Create emoji_reactions table
    op.create_table(
        'emoji_reactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.String(), nullable=False),
        sa.Column('emoji_code', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'post_id', name='unique_user_post_reaction')
    )
    
    # Create indexes for performance
    op.create_index('idx_emoji_reactions_post_id', 'emoji_reactions', ['post_id'])
    op.create_index('idx_emoji_reactions_user_id', 'emoji_reactions', ['user_id'])
    op.create_index('idx_emoji_reactions_created_at', 'emoji_reactions', ['created_at'])
    
    # Create check constraint for valid emoji codes
    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        "emoji_code IN ('heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap')"
    )


def downgrade() -> None:
    """Drop emoji_reactions table and related constraints."""
    
    # Drop indexes
    op.drop_index('idx_emoji_reactions_created_at', table_name='emoji_reactions')
    op.drop_index('idx_emoji_reactions_user_id', table_name='emoji_reactions')
    op.drop_index('idx_emoji_reactions_post_id', table_name='emoji_reactions')
    
    # Drop table (constraints will be dropped automatically)
    op.drop_table('emoji_reactions')