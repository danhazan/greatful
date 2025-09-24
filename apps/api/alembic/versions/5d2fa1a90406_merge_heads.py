"""merge heads

Revision ID: 5d2fa1a90406
Revises: 006_shares_table, 1acf9fb80bfb
Create Date: 2025-08-27 17:58:38.385998

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5d2fa1a90406'
down_revision = ('006_shares_table', '1acf9fb80bfb')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass