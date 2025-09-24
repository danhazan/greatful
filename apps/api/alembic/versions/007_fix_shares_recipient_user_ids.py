"""Fix shares table recipient_user_ids column to allow NULL for URL shares

Revision ID: 007_fix_shares_recipient_user_ids
Revises: d3cd51afbd09
Create Date: 2025-08-27 19:06:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_fix_shares'
down_revision = 'd3cd51afbd09'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix the recipient_user_ids column to properly handle NULL values for URL shares."""
    
    # The issue is that the column was created as integer[] but the model expects to be able to insert NULL
    # We need to ensure the column allows NULL values and handles them properly
    
    # First, update any existing NULL values to empty arrays if needed
    op.execute("UPDATE shares SET recipient_user_ids = '{}' WHERE recipient_user_ids IS NULL AND share_method = 'message'")
    
    # The column should already allow NULL, but let's make sure the constraint is correct
    # Remove the old constraint that requires recipients for message shares
    op.drop_constraint('message_shares_have_recipients', 'shares', type_='check')
    
    # Add a new constraint that only requires recipients for message shares, but allows NULL for URL shares
    op.create_check_constraint(
        'message_shares_recipients_check',
        'shares',
        "(share_method = 'url') OR (share_method = 'message' AND recipient_user_ids IS NOT NULL AND array_length(recipient_user_ids, 1) > 0)"
    )


def downgrade() -> None:
    """Revert the constraint changes."""
    
    # Drop the new constraint
    op.drop_constraint('message_shares_recipients_check', 'shares', type_='check')
    
    # Restore the old constraint
    op.create_check_constraint(
        'message_shares_have_recipients',
        'shares',
        "(share_method != 'message' OR recipient_user_ids IS NOT NULL)"
    )