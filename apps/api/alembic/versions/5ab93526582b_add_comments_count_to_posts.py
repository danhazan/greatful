"""add_comments_count_to_posts

Revision ID: 5ab93526582b
Revises: 414d7def8605
Create Date: 2025-12-05 18:39:59.501429

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5ab93526582b'
down_revision = '414d7def8605'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add comments_count column to posts table
    op.add_column('posts', sa.Column('comments_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove comments_count column from posts table
    op.drop_column('posts', 'comments_count')