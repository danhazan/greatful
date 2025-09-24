"""Add bio and profile_image_url to users table

Revision ID: 002_add_user_profile_fields
Revises: 001_create_emoji_reactions_table
Create Date: 2025-01-08 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_user_profile_fields'
down_revision = '001_emoji_reactions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add bio and profile_image_url fields to users table."""
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('profile_image_url', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove bio and profile_image_url fields from users table."""
    op.drop_column('users', 'profile_image_url')
    op.drop_column('users', 'bio')