"""Add last_updated_at field to notifications

Revision ID: 005_add_last_updated_at_field
Revises: 004_add_notification_batching_fields
Create Date: 2025-08-26 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_add_last_updated_at_field'
down_revision = '004_batch_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add last_updated_at field to notifications table."""
    # Add the last_updated_at column
    op.add_column('notifications', sa.Column('last_updated_at', sa.DateTime(), nullable=True))
    
    # Update existing notifications to set last_updated_at = created_at
    op.execute("UPDATE notifications SET last_updated_at = created_at WHERE last_updated_at IS NULL")


def downgrade() -> None:
    """Remove last_updated_at field from notifications table."""
    op.drop_column('notifications', 'last_updated_at')