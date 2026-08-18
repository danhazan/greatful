"""add_web_session_bootstraps_table

Revision ID: b3500c2dcc55
Revises: a9b8c7d6e5f4
Create Date: 2026-08-18 15:17:07.132589

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b3500c2dcc55'
down_revision = 'a9b8c7d6e5f4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('web_session_bootstraps',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('purpose', sa.String(length=32), nullable=False),
    sa.Column('audience', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_web_session_bootstraps_expires_at'), 'web_session_bootstraps', ['expires_at'], unique=False)
    op.create_index(op.f('ix_web_session_bootstraps_id'), 'web_session_bootstraps', ['id'], unique=False)
    op.create_index(op.f('ix_web_session_bootstraps_token_hash'), 'web_session_bootstraps', ['token_hash'], unique=True)
    op.create_index('ix_web_session_bootstraps_user_created', 'web_session_bootstraps', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_web_session_bootstraps_user_id'), 'web_session_bootstraps', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_web_session_bootstraps_user_id'), table_name='web_session_bootstraps')
    op.drop_index('ix_web_session_bootstraps_user_created', table_name='web_session_bootstraps')
    op.drop_index(op.f('ix_web_session_bootstraps_token_hash'), table_name='web_session_bootstraps')
    op.drop_index(op.f('ix_web_session_bootstraps_id'), table_name='web_session_bootstraps')
    op.drop_index(op.f('ix_web_session_bootstraps_expires_at'), table_name='web_session_bootstraps')
    op.drop_table('web_session_bootstraps')