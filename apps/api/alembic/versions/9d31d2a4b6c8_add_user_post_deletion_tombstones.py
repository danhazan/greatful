"""add_user_post_deletion_tombstones

Revision ID: 9d31d2a4b6c8
Revises: 7c2a4797162b
Create Date: 2026-06-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "9d31d2a4b6c8"
down_revision = "7c2a4797162b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("account_status", sa.String(length=20), server_default="active", nullable=False))
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_source", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("token_version", sa.Integer(), server_default="0", nullable=False))
    op.create_index("ix_users_account_status", "users", ["account_status"], unique=False)

    op.add_column("posts", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("posts", sa.Column("deletion_source", sa.String(length=20), nullable=True))
    op.create_index("ix_posts_deleted_at", "posts", ["deleted_at"], unique=False)
    op.create_index("idx_posts_author_deleted", "posts", ["author_id", "deleted_at"], unique=False)

    op.create_table(
        "deleted_user_auth_identities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("identity_type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("provider_user_id", sa.String(length=255), nullable=True),
        sa.Column("email_hash", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "identity_type", "provider", "provider_user_id", name="uq_deleted_user_identity"),
    )
    op.create_index("ix_deleted_user_auth_identities_id", "deleted_user_auth_identities", ["id"], unique=False)
    op.create_index("ix_deleted_user_auth_identities_user_id", "deleted_user_auth_identities", ["user_id"], unique=False)
    op.create_index("ix_deleted_user_auth_identities_email_hash", "deleted_user_auth_identities", ["email_hash"], unique=False)
    op.create_index("idx_deleted_user_identity_provider", "deleted_user_auth_identities", ["provider", "provider_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_deleted_user_identity_provider", table_name="deleted_user_auth_identities")
    op.drop_index("ix_deleted_user_auth_identities_email_hash", table_name="deleted_user_auth_identities")
    op.drop_index("ix_deleted_user_auth_identities_user_id", table_name="deleted_user_auth_identities")
    op.drop_index("ix_deleted_user_auth_identities_id", table_name="deleted_user_auth_identities")
    op.drop_table("deleted_user_auth_identities")

    op.drop_index("idx_posts_author_deleted", table_name="posts")
    op.drop_index("ix_posts_deleted_at", table_name="posts")
    op.drop_column("posts", "deletion_source")
    op.drop_column("posts", "deleted_at")

    op.drop_index("ix_users_account_status", table_name="users")
    op.drop_column("users", "token_version")
    op.drop_column("users", "deletion_source")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "deletion_requested_at")
    op.drop_column("users", "account_status")
