"""fix_emoji_codes_constraint

Revision ID: 457cde4eec06
Revises: 5ab93526582b
Create Date: 2025-12-10 23:53:30.710091

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '457cde4eec06'
down_revision = '5ab93526582b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing constraint
    op.drop_constraint('valid_emoji_codes', 'emoji_reactions', type_='check')
    
    # Add the updated constraint with the correct emoji codes that match frontend
    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        "emoji_code IN ('heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap', 'grateful', 'praise')"
    )


def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint('valid_emoji_codes', 'emoji_reactions', type_='check')
    
    # Restore the original constraint
    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        "emoji_code IN ('heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap')"
    )