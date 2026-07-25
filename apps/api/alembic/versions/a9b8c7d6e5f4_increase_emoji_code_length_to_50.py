"""Increase emoji_code length from 20 to 50.

Canonical inventory (shared/reactions.json) has 401 codes.
Longest: backhand_index_pointing_right (29 chars).
12 codes exceed the original String(20) limit.

Revision ID: a9b8c7d6e5f4
Revises: e7b1a2c3d4f5
Create Date: 2026-07-21 12:00:00.000000+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9b8c7d6e5f4'
down_revision = 'e7b1a2c3d4f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'emoji_reactions',
        'emoji_code',
        type_=sa.String(50),
        existing_type=sa.String(20),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'emoji_reactions',
        'emoji_code',
        type_=sa.String(20),
        existing_type=sa.String(50),
        nullable=False,
    )
