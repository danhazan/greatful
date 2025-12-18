"""add_post_images_table

Revision ID: a7b3c9d2e4f1
Revises: 58c17abd7cc6
Create Date: 2025-12-17

Multi-image post support: Creates post_images table for storing multiple
images per post with variant URLs (thumbnail, medium, original).
Also migrates existing single image_url data to the new table.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = 'a7b3c9d2e4f1'
down_revision = '58c17abd7cc6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create post_images table
    op.create_table(
        'post_images',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('post_id', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('thumbnail_url', sa.String(500), nullable=False),
        sa.Column('medium_url', sa.String(500), nullable=False),
        sa.Column('original_url', sa.String(500), nullable=False),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for performance
    op.create_index('ix_post_images_post_id', 'post_images', ['post_id'])
    op.create_index('idx_post_images_post_position', 'post_images', ['post_id', 'position'])

    # Migrate existing image_url data to post_images table
    # For existing posts with images, create a PostImage record at position 0
    # Using the same URL for all variants initially (no variants exist for legacy images)
    connection = op.get_bind()
    connection.execute(text("""
        INSERT INTO post_images (id, post_id, position, thumbnail_url, medium_url, original_url, created_at)
        SELECT
            gen_random_uuid()::text,
            id,
            0,
            image_url,
            image_url,
            image_url,
            created_at
        FROM posts
        WHERE image_url IS NOT NULL AND image_url != ''
    """))


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_post_images_post_position', table_name='post_images')
    op.drop_index('ix_post_images_post_id', table_name='post_images')

    # Drop post_images table
    op.drop_table('post_images')
