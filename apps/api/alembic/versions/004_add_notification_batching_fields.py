"""add_notification_batching_fields

Revision ID: 004_add_notification_batching_fields
Revises: ecb4d319f326
Create Date: 2025-08-26 16:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_batch_fields'
down_revision = 'ecb4d319f326'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add batching fields to notifications table
    op.add_column('notifications', sa.Column('parent_id', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('is_batch', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notifications', sa.Column('batch_count', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('notifications', sa.Column('batch_key', sa.String(), nullable=True))
    
    # Create indexes for better performance
    op.create_index('ix_notifications_parent_id', 'notifications', ['parent_id'])
    op.create_index('ix_notifications_batch_key', 'notifications', ['batch_key'])
    
    # Create foreign key constraint for parent_id
    op.create_foreign_key('fk_notifications_parent_id', 'notifications', 'notifications', ['parent_id'], ['id'])


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_notifications_parent_id', 'notifications', type_='foreignkey')
    
    # Drop indexes
    op.drop_index('ix_notifications_batch_key', table_name='notifications')
    op.drop_index('ix_notifications_parent_id', table_name='notifications')
    
    # Drop columns
    op.drop_column('notifications', 'batch_key')
    op.drop_column('notifications', 'batch_count')
    op.drop_column('notifications', 'is_batch')
    op.drop_column('notifications', 'parent_id')