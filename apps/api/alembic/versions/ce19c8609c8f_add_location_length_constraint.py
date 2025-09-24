"""add_location_length_constraint

Revision ID: ce19c8609c8f
Revises: dc1d837e0783
Create Date: 2025-09-06 16:46:10.833419

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ce19c8609c8f'
down_revision = 'dc1d837e0783'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add length constraint to location field (150 characters)
    # First, truncate any existing long locations
    op.execute("""
        UPDATE posts 
        SET location = LEFT(location, 147) || '...' 
        WHERE location IS NOT NULL AND LENGTH(location) > 150
    """)
    
    # Alter column to add length constraint
    op.alter_column('posts', 'location',
                   existing_type=sa.String(),
                   type_=sa.String(150),
                   existing_nullable=True)


def downgrade() -> None:
    # Remove length constraint
    op.alter_column('posts', 'location',
                   existing_type=sa.String(150),
                   type_=sa.String(),
                   existing_nullable=True)