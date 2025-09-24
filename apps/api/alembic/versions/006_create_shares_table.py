"""Create shares table

Revision ID: 006_shares_table
Revises: 005_add_last_updated_at_field
Create Date: 2025-01-08 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_shares_table'
down_revision = '005_add_last_updated_at_field'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create shares table with proper constraints and indexes."""
    
    # Create shares table
    op.create_table(
        'shares',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.String(), nullable=False),
        sa.Column('share_method', sa.String(20), nullable=False),
        sa.Column('recipient_user_ids', sa.Text(), nullable=True),
        sa.Column('message_content', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('idx_shares_post_id', 'shares', ['post_id'])
    op.create_index('idx_shares_user_id', 'shares', ['user_id'])
    op.create_index('idx_shares_created_at', 'shares', ['created_at'])
    op.create_index('idx_shares_share_method', 'shares', ['share_method'])
    
    # Create check constraint for valid share methods
    op.create_check_constraint(
        'valid_share_methods',
        'shares',
        "share_method IN ('url', 'message')"
    )
    
    # Create check constraint for message shares having recipients
    op.create_check_constraint(
        'message_shares_have_recipients',
        'shares',
        "(share_method != 'message' OR recipient_user_ids IS NOT NULL)"
    )


def downgrade() -> None:
    """Drop shares table and related constraints."""
    
    # Drop indexes
    op.drop_index('idx_shares_share_method', table_name='shares')
    op.drop_index('idx_shares_created_at', table_name='shares')
    op.drop_index('idx_shares_user_id', table_name='shares')
    op.drop_index('idx_shares_post_id', table_name='shares')
    
    # Drop table (constraints will be dropped automatically)
    op.drop_table('shares')