#!/usr/bin/env python3
"""
Test script to verify the complete notification flow.
Run this to check if notifications are being created when reactions are added.
"""

import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'apps/api'))

from app.core.database import get_db
from app.models.user import User
from app.models.post import Post
from app.services.reaction_service import ReactionService
from app.services.notification_service import NotificationService
from sqlalchemy import text

async def test_notification_flow():
    """Test the complete notification flow from reaction to notification."""
    
    print("🧪 Starting notification flow test...")
    
    async for db in get_db():
        try:
            # Create test users
            print("📝 Creating test users...")
            user1 = User(username='testuser1', email='test1@example.com', hashed_password='test')
            user2 = User(username='testuser2', email='test2@example.com', hashed_password='test')
            
            db.add(user1)
            db.add(user2)
            await db.commit()
            await db.refresh(user1)
            await db.refresh(user2)
            
            print(f"✅ Created users: {user1.username} (ID: {user1.id}), {user2.username} (ID: {user2.id})")
            
            # Create test post
            print("📝 Creating test post...")
            post = Post(content='Test post for notifications', author_id=user1.id)
            db.add(post)
            await db.commit()
            await db.refresh(post)
            
            print(f"✅ Created post: {post.id} by user {user1.id}")
            
            # Check initial notification count
            initial_notifications = await NotificationService.get_user_notifications(db, user1.id)
            print(f"📊 Initial notifications for user {user1.id}: {len(initial_notifications)}")
            
            # Add reaction (this should create a notification)
            print("🎭 Adding emoji reaction...")
            reaction = await ReactionService.add_reaction(
                db=db,
                user_id=user2.id,  # user2 reacts to user1's post
                post_id=str(post.id),
                emoji_code='heart_eyes'
            )
            
            print(f"✅ Created reaction: {reaction.id} by user {user2.id}")
            
            # Check notifications after reaction
            final_notifications = await NotificationService.get_user_notifications(db, user1.id)
            print(f"📊 Final notifications for user {user1.id}: {len(final_notifications)}")
            
            # Analyze the notifications
            if len(final_notifications) > len(initial_notifications):
                new_notification = final_notifications[0]  # Most recent first
                print(f"🎉 SUCCESS: New notification created!")
                print(f"   ID: {new_notification.id}")
                print(f"   Type: {new_notification.type}")
                print(f"   Message: {new_notification.message}")
                print(f"   User ID: {new_notification.user_id}")
                print(f"   Data: {new_notification.data}")
                print(f"   Read: {new_notification.read}")
                print(f"   Created: {new_notification.created_at}")
                
                # Test the API response format
                print("\n🔍 Testing API response format...")
                from app.api.v1.notifications import NotificationResponse
                
                # Simulate what the API would return
                api_response = NotificationResponse(
                    id=new_notification.id,
                    type=new_notification.type,
                    title=new_notification.title,
                    message=new_notification.message,
                    data=new_notification.data or {},
                    read=new_notification.read,
                    created_at=new_notification.created_at.isoformat(),
                    post_id=new_notification.data.get('post_id') if new_notification.data else None,
                    from_user={
                        'id': '0',
                        'username': new_notification.data.get('reactor_username') if new_notification.data else 'unknown',
                        'profile_image_url': None
                    } if new_notification.data and 'reactor_username' in new_notification.data else None
                )
                
                print(f"✅ API Response would be:")
                print(f"   ID: {api_response.id}")
                print(f"   Type: {api_response.type}")
                print(f"   Message: {api_response.message}")
                print(f"   Post ID: {api_response.post_id}")
                print(f"   From User: {api_response.from_user}")
                
            else:
                print("❌ FAILURE: No new notification was created!")
                print("   This indicates the notification system is not working.")
                
                # Check if it was a self-notification (should be prevented)
                if user1.id == user2.id:
                    print("   Note: This was a self-notification (user reacting to own post)")
                else:
                    print("   This should have created a notification. Investigating...")
                    
                    # Check rate limiting
                    stats = await NotificationService.get_notification_stats(db, user1.id, 'emoji_reaction')
                    print(f"   Rate limit stats: {stats}")
            
            # Test direct database query
            print("\n🔍 Direct database query for notifications...")
            result = await db.execute(
                text("SELECT * FROM notifications WHERE user_id = :user_id ORDER BY created_at DESC"),
                {"user_id": user1.id}
            )
            db_notifications = result.fetchall()
            print(f"📊 Direct DB query found {len(db_notifications)} notifications")
            
            for i, notif in enumerate(db_notifications):
                print(f"   {i+1}. ID: {notif.id}, Type: {notif.type}, Message: {notif.message}")
            
        except Exception as e:
            print(f"❌ Error during test: {e}")
            import traceback
            traceback.print_exc()
        
        break

if __name__ == "__main__":
    asyncio.run(test_notification_flow())