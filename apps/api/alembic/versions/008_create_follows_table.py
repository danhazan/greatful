"""Create follows table for user follow relationships

Revision ID: 008_create_follows
Revises: 472806beeb72
Create Date: 2025-08-29 12:35:30.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_create_follows'
down_revision = '472806beeb72'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create follows table for user follow relationships."""
    
    # Create follows table
    op.create_table(
        'follows',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('follower_id', sa.Integer(), nullable=False),
        sa.Column('followed_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['followed_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('follower_id', 'followed_id', name='unique_follower_followed'),
        sa.CheckConstraint('follower_id != followed_id', name='no_self_follow')
    )
    
    # Create indexes for performance
    op.create_index('idx_follows_follower_id', 'follows', ['follower_id'])
    op.create_index('idx_follows_followed_id', 'follows', ['followed_id'])
    op.create_index('idx_follows_status', 'follows', ['status'])
    op.create_index('idx_follows_created_at', 'follows', ['created_at'])


def downgrade() -> None:
    """Drop follows table and related constraints."""
    
    # Drop indexes
    op.drop_index('idx_follows_created_at', table_name='follows')
    op.drop_index('idx_follows_status', table_name='follows')
    op.drop_index('idx_follows_followed_id', table_name='follows')
    op.drop_index('idx_follows_follower_id', table_name='follows')
    
    # Drop table (constraints will be dropped automatically)
    op.drop_table('follows')