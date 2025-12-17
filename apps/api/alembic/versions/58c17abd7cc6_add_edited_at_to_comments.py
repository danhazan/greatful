"""add_edited_at_to_comments

Revision ID: 58c17abd7cc6
Revises: 1ecc041272a4
Create Date: 2025-12-16 22:53:02.134443

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '58c17abd7cc6'
down_revision = '1ecc041272a4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add edited_at column to comments table for tracking user edits
    op.add_column('comments', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove edited_at column from comments table
    op.drop_column('comments', 'edited_at')
