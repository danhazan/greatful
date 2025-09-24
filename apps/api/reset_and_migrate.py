#!/usr/bin/env python3
"""
Script to handle migration reset and setup for Railway deployment
"""

import os
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def reset_and_migrate():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found")
        sys.exit(1)
    
    print(f"🔧 Starting migration reset and setup...")
    print(f"Database URL: {database_url[:50]}...")
    
    # Create async engine with better error handling
    engine = create_async_engine(database_url, echo=True)
    
    try:
        # Test connection first
        print("🔌 Testing database connection...")
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            print("✅ Database connection successful")
        
        async with engine.begin() as conn:
            # 1. Drop and recreate alembic_version table to ensure clean state
            print("🧹 Ensuring clean alembic_version table...")
            await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
            await conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL, 
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))
            print("✅ Clean alembic_version table created")
            
            # 2. Check if we have any existing application tables
            print("📋 Checking existing application tables...")
            result = await conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name NOT IN ('alembic_version')
                ORDER BY table_name
            """))
            existing_tables = [row[0] for row in result.fetchall()]
            print(f"Existing tables: {existing_tables}")
            
            expected_tables = ['users', 'posts', 'emoji_reactions', 'likes', 'follows', 'shares', 'mentions', 'notifications', 'user_interactions']
            
            if len(existing_tables) == 0:
                print("✅ Database is empty - migration will create all tables")
            elif set(existing_tables) >= set(expected_tables):
                print("✅ All expected tables exist - marking as migrated")
                # Set the migration as already applied
                await conn.execute(text(
                    "INSERT INTO alembic_version (version_num) VALUES ('d23c18f82103')"
                ))
                print("✅ Database marked as up-to-date with consolidated migration")
            else:
                print(f"⚠️  Partial tables found: {existing_tables}")
                print("🔄 Dropping partial tables for clean migration")
                # Drop existing tables to ensure clean migration
                for table in existing_tables:
                    await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                print("✅ Partial tables dropped - migration will create all tables")
            
            print("🎉 Migration setup completed successfully!")
            
    except Exception as e:
        print(f"❌ Error during migration setup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_and_migrate())