"""Add username constraints and lowercase trigger

Revision ID: 7c99f5b56f04
Revises: 8ae24ef9616d
Create Date: 2025-10-06 14:27:45.237554

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '7c99f5b56f04'
down_revision = '8ae24ef9616d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update existing usernames to lowercase BEFORE applying constraints
    op.execute("UPDATE users SET username = lower(username)")

    # Create the function to force username to lowercase
    op.execute("""
        CREATE OR REPLACE FUNCTION force_username_lowercase()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.username := lower(NEW.username);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create the trigger on the users table
    op.execute("""
        CREATE TRIGGER trigger_username_lowercase
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION force_username_lowercase();
    """)

    # Add the CHECK constraint for username validation
    # This will fail if existing data is invalid (e.g., too short), manual cleanup may be needed
    op.execute("""
        ALTER TABLE users
        ADD CONSTRAINT username_validation_check
        CHECK (
            username = lower(username) AND
            username ~ '^[a-z0-9_]+$' AND
            LENGTH(username) BETWEEN 3 AND 30
        );
    """)


def downgrade() -> None:
    # Remove the CHECK constraint
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS username_validation_check")

    # Drop the trigger
    op.execute("DROP TRIGGER IF EXISTS trigger_username_lowercase ON users")

    # Drop the function
    op.execute("DROP FUNCTION IF EXISTS force_username_lowercase")