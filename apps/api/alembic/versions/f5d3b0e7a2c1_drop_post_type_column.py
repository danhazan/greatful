"""drop_post_type_column

Revision ID: f5d3b0e7a2c1
Revises: e4c2a9d8f1b0
Create Date: 2026-03-30 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f5d3b0e7a2c1'
down_revision = 'e4c2a9d8f1b0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('posts', 'post_type')
    # Drop the PostgreSQL enum type
    op.execute("DROP TYPE IF EXISTS posttype")


def downgrade() -> None:
    # Recreate the enum type
    post_type_enum = sa.Enum('daily', 'photo', 'spontaneous', name='posttype', schema='public')
    post_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('posts', sa.Column('post_type', post_type_enum, nullable=False, server_default='daily'))
