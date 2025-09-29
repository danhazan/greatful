"""add_whatsapp_share_method

Revision ID: 3ac9fb87a9a2
Revises: b4abda6d1c48
Create Date: 2025-09-29 04:48:57.507523

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3ac9fb87a9a2'
down_revision = 'b4abda6d1c48'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No database schema changes needed - the shares.share_method column
    # already supports string values and can store "whatsapp"
    # This migration is for tracking the feature addition
    pass


def downgrade() -> None:
    # No database schema changes to revert
    pass