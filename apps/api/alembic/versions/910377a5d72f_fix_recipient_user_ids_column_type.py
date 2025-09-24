"""fix_recipient_user_ids_column_type

Revision ID: 910377a5d72f
Revises: 007_fix_shares
Create Date: 2025-08-27 22:39:19.763335

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '910377a5d72f'
down_revision = '007_fix_shares'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix recipient_user_ids column type from Text to integer array for PostgreSQL."""
    
    # First, drop the existing constraint that references the column
    op.drop_constraint('message_shares_recipients_check', 'shares', type_='check')
    
    # First, clean up any problematic data
    op.execute("UPDATE shares SET recipient_user_ids = NULL WHERE recipient_user_ids = '' OR recipient_user_ids = '[]'")
    
    # Convert the column from Text to integer array
    # For existing data, we need to handle the conversion carefully
    op.execute("""
        ALTER TABLE shares 
        ALTER COLUMN recipient_user_ids 
        TYPE integer[] 
        USING CASE 
            WHEN recipient_user_ids IS NULL THEN NULL
            WHEN recipient_user_ids = '' THEN NULL
            WHEN recipient_user_ids = '[]' THEN NULL
            WHEN recipient_user_ids ~ '^\\[.*\\]$' THEN 
                CASE 
                    WHEN trim(both '[]' from recipient_user_ids) = '' THEN NULL
                    ELSE string_to_array(trim(both '[]' from recipient_user_ids), ',')::integer[]
                END
            ELSE NULL
        END
    """)
    
    # Recreate the constraint with proper array handling
    op.create_check_constraint(
        'message_shares_recipients_check',
        'shares',
        "(share_method = 'url') OR (share_method = 'message' AND recipient_user_ids IS NOT NULL AND array_length(recipient_user_ids, 1) > 0)"
    )


def downgrade() -> None:
    """Revert recipient_user_ids column type back to Text."""
    
    # Drop the constraint
    op.drop_constraint('message_shares_recipients_check', 'shares', type_='check')
    
    # Convert back to Text
    op.execute("""
        ALTER TABLE shares 
        ALTER COLUMN recipient_user_ids 
        TYPE text 
        USING CASE 
            WHEN recipient_user_ids IS NULL THEN NULL
            ELSE array_to_string(recipient_user_ids, ',')
        END
    """)
    
    # Recreate the old constraint
    op.create_check_constraint(
        'message_shares_have_recipients',
        'shares',
        "(share_method != 'message' OR recipient_user_ids IS NOT NULL)"
    )