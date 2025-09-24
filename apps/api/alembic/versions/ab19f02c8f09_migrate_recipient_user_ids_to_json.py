"""migrate_recipient_user_ids_to_json

Revision ID: ab19f02c8f09
Revises: 910377a5d72f
Create Date: 2025-08-27 22:50:05.889570

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab19f02c8f09'
down_revision = '910377a5d72f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate recipient_user_ids from integer[] or text to JSON/JSONB."""
    
    # Import postgresql dialect for JSONB
    from sqlalchemy.dialects import postgresql
    
    # 1) Add new JSON/JSONB column (nullable)
    op.add_column(
        "shares",
        sa.Column(
            "recipient_user_ids_json",
            sa.JSON().with_variant(postgresql.JSONB, "postgresql"),
            nullable=True,
        ),
    )

    # 2) Data migration - handle both integer[] and text formats
    op.execute(
        """
        DO $$
        BEGIN
          -- Check if old column is integer[] type
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='shares' AND column_name='recipient_user_ids' AND udt_name = '_int4'
          ) THEN
            -- integer[] -> jsonb conversion
            UPDATE shares 
               SET recipient_user_ids_json = to_jsonb(recipient_user_ids);
          ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='shares' AND column_name='recipient_user_ids' AND data_type='text'
          ) THEN
            -- text -> jsonb conversion with safe parsing
            UPDATE shares 
               SET recipient_user_ids_json = 
                 CASE 
                   WHEN recipient_user_ids IS NULL OR btrim(recipient_user_ids) = '' THEN NULL
                   WHEN recipient_user_ids ~ '^\\s*\\[.*\\]\\s*$' THEN recipient_user_ids::jsonb
                   WHEN recipient_user_ids ~ '^\\{.*\\}$' THEN 
                     to_jsonb(string_to_array(trim(both '{}' from recipient_user_ids), ',')::int[])
                   ELSE NULL
                 END;
          END IF;
        END $$;
        """
    )

    # 3) Drop old column and rename new one
    op.drop_column("shares", "recipient_user_ids")
    op.alter_column("shares", "recipient_user_ids_json", new_column_name="recipient_user_ids")


def downgrade() -> None:
    """Downgrade to text format (best-effort to avoid data loss)."""
    
    # Add text column
    op.add_column("shares", sa.Column("recipient_user_ids_text", sa.Text, nullable=True))
    
    # Convert JSON back to text
    op.execute(
        """
        UPDATE shares 
           SET recipient_user_ids_text = 
             CASE 
               WHEN recipient_user_ids IS NULL THEN NULL
               ELSE recipient_user_ids::text 
             END;
        """
    )
    
    # Drop JSON column and rename text column
    op.drop_column("shares", "recipient_user_ids")
    op.alter_column("shares", "recipient_user_ids_text", new_column_name="recipient_user_ids")