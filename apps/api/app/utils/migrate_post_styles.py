"""
Migration utility to clean existing post styles by removing font-related properties.
This ensures backward compatibility when the post_style validation is updated.
"""

import asyncio
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from app.core.database import get_async_session
from app.models.post import Post
from app.utils.post_style_validator import PostStyleValidator

logger = logging.getLogger(__name__)


async def migrate_post_styles(db: AsyncSession, dry_run: bool = True) -> Dict[str, Any]:
    """
    Migrate existing post styles to remove font-related properties.
    
    Args:
        db: Database session
        dry_run: If True, only analyze what would be changed without making changes
        
    Returns:
        Dictionary with migration results
    """
    results = {
        "total_posts_with_styles": 0,
        "posts_needing_migration": 0,
        "posts_migrated": 0,
        "migration_errors": [],
        "sample_changes": []
    }
    
    try:
        # Get all posts with post_style data
        query = select(Post).where(Post.post_style.isnot(None))
        result = await db.execute(query)
        posts = result.scalars().all()
        
        results["total_posts_with_styles"] = len(posts)
        logger.info(f"Found {len(posts)} posts with post_style data")
        
        posts_to_update = []
        
        for post in posts:
            try:
                if not isinstance(post.post_style, dict):
                    continue
                
                # Clean the post style
                original_style = post.post_style.copy()
                cleaned_style = PostStyleValidator.clean_post_style(post.post_style)
                
                # Check if anything was removed
                if original_style != cleaned_style:
                    results["posts_needing_migration"] += 1
                    
                    # Store sample changes for the first few posts
                    if len(results["sample_changes"]) < 5:
                        removed_props = set(original_style.keys()) - set(cleaned_style.keys())
                        results["sample_changes"].append({
                            "post_id": post.id,
                            "removed_properties": list(removed_props),
                            "original_style": original_style,
                            "cleaned_style": cleaned_style
                        })
                    
                    if not dry_run:
                        posts_to_update.append({
                            "post_id": post.id,
                            "cleaned_style": cleaned_style
                        })
                
            except Exception as e:
                error_msg = f"Error processing post {post.id}: {str(e)}"
                logger.error(error_msg)
                results["migration_errors"].append(error_msg)
        
        # Perform the actual updates if not a dry run
        if not dry_run and posts_to_update:
            logger.info(f"Updating {len(posts_to_update)} posts...")
            
            for update_data in posts_to_update:
                try:
                    # Update the post style
                    update_stmt = (
                        update(Post)
                        .where(Post.id == update_data["post_id"])
                        .values(post_style=update_data["cleaned_style"])
                    )
                    await db.execute(update_stmt)
                    results["posts_migrated"] += 1
                    
                except Exception as e:
                    error_msg = f"Error updating post {update_data['post_id']}: {str(e)}"
                    logger.error(error_msg)
                    results["migration_errors"].append(error_msg)
            
            # Commit all changes
            await db.commit()
            logger.info(f"Successfully migrated {results['posts_migrated']} posts")
        
        elif dry_run:
            logger.info(f"DRY RUN: Would update {results['posts_needing_migration']} posts")
        
    except Exception as e:
        error_msg = f"Migration failed: {str(e)}"
        logger.error(error_msg)
        results["migration_errors"].append(error_msg)
        if not dry_run:
            await db.rollback()
    
    return results


async def validate_migrated_styles(db: AsyncSession) -> Dict[str, Any]:
    """
    Validate that all post styles conform to the new validation rules.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with validation results
    """
    results = {
        "total_posts_checked": 0,
        "valid_posts": 0,
        "invalid_posts": 0,
        "validation_errors": []
    }
    
    try:
        # Get all posts with post_style data
        query = select(Post).where(Post.post_style.isnot(None))
        result = await db.execute(query)
        posts = result.scalars().all()
        
        results["total_posts_checked"] = len(posts)
        
        for post in posts:
            try:
                # Validate the post style
                PostStyleValidator.validate_post_style(post.post_style)
                results["valid_posts"] += 1
                
            except Exception as e:
                results["invalid_posts"] += 1
                error_info = {
                    "post_id": post.id,
                    "error": str(e),
                    "post_style": post.post_style
                }
                results["validation_errors"].append(error_info)
                logger.warning(f"Post {post.id} has invalid post_style: {str(e)}")
        
        logger.info(f"Validation complete: {results['valid_posts']} valid, {results['invalid_posts']} invalid")
        
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}")
        results["validation_errors"].append({"error": str(e)})
    
    return results


async def main():
    """Main function to run the migration."""
    logging.basicConfig(level=logging.INFO)
    
    async with get_async_session() as db:
        print("=== Post Style Migration Tool ===")
        print()
        
        # First, run a dry run to see what would be changed
        print("1. Running dry run analysis...")
        dry_run_results = await migrate_post_styles(db, dry_run=True)
        
        print(f"Total posts with styles: {dry_run_results['total_posts_with_styles']}")
        print(f"Posts needing migration: {dry_run_results['posts_needing_migration']}")
        
        if dry_run_results["sample_changes"]:
            print("\nSample changes that would be made:")
            for change in dry_run_results["sample_changes"]:
                print(f"  Post {change['post_id']}: Remove {change['removed_properties']}")
        
        if dry_run_results["migration_errors"]:
            print(f"\nErrors encountered: {len(dry_run_results['migration_errors'])}")
            for error in dry_run_results["migration_errors"][:3]:
                print(f"  {error}")
        
        # Ask for confirmation to proceed
        if dry_run_results["posts_needing_migration"] > 0:
            print(f"\nProceed with migrating {dry_run_results['posts_needing_migration']} posts? (y/N): ", end="")
            response = input().strip().lower()
            
            if response == 'y':
                print("\n2. Running actual migration...")
                migration_results = await migrate_post_styles(db, dry_run=False)
                print(f"Successfully migrated: {migration_results['posts_migrated']} posts")
                
                if migration_results["migration_errors"]:
                    print(f"Migration errors: {len(migration_results['migration_errors'])}")
                
                # Validate the results
                print("\n3. Validating migrated styles...")
                validation_results = await validate_migrated_styles(db)
                print(f"Valid posts: {validation_results['valid_posts']}")
                print(f"Invalid posts: {validation_results['invalid_posts']}")
                
                if validation_results["invalid_posts"] > 0:
                    print("Some posts still have invalid styles. Check the logs for details.")
                else:
                    print("All post styles are now valid!")
            else:
                print("Migration cancelled.")
        else:
            print("\nNo posts need migration. All post styles are already clean!")


if __name__ == "__main__":
    asyncio.run(main())