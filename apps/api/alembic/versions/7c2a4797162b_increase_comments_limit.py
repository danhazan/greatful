"""increase_comments_limit

Revision ID: 7c2a4797162b
Revises: d4e5f6a7b8c9
Create Date: 2026-05-26 17:52:54.572100

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7c2a4797162b'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old constraint
    op.drop_constraint('check_content_length', 'comments', type_='check')
    
    # Create the new constraint for 2000 characters
    # Note: Using literal strings for migration reproducibility rather than importing constants
    op.create_check_constraint(
        'check_content_length',
        'comments',
        'LENGTH(content) >= 1 AND LENGTH(content) <= 2000'
    )


def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint('check_content_length', 'comments', type_='check')
    
    # Revert to the old constraint for 500 characters
    op.create_check_constraint(
        'check_content_length',
        'comments',
        'LENGTH(content) >= 1 AND LENGTH(content) <= 500'
    )