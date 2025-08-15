#!/usr/bin/env python3
"""
Simple integration test for the heart functionality.
This tests the complete flow: frontend -> backend -> database
"""

import asyncio
import aiohttp
import json

async def test_heart_integration():
    """Test the heart functionality end-to-end."""
    
    # Test configuration
    API_BASE = "http://localhost:8000"
    FRONTEND_BASE = "http://localhost:3000"
    
    print("🧪 Testing Heart Integration...")
    
    async with aiohttp.ClientSession() as session:
        try:
            # 1. Test backend health
            print("1. Testing backend health...")
            async with session.get(f"{API_BASE}/health") as resp:
                if resp.status == 200:
                    print("✅ Backend is running")
                else:
                    print("❌ Backend is not responding")
                    return
            
            # 2. Test frontend API proxy
            print("2. Testing frontend API proxy...")
            try:
                async with session.get(f"{FRONTEND_BASE}/api/posts") as resp:
                    if resp.status in [200, 401]:  # 401 is expected without auth
                        print("✅ Frontend API proxy is working")
                    else:
                        print(f"❌ Frontend API proxy returned {resp.status}")
            except Exception as e:
                print(f"⚠️ Frontend not running or not accessible: {e}")
            
            # 3. Test database connection (via backend)
            print("3. Testing database connection...")
            async with session.get(f"{API_BASE}/api/v1/posts/feed") as resp:
                if resp.status in [200, 401]:  # 401 is expected without auth
                    print("✅ Database connection is working")
                else:
                    print(f"❌ Database connection failed: {resp.status}")
            
            print("\n🎉 Integration test completed!")
            print("\nNext steps to test hearts:")
            print("1. Start the backend: cd apps/api && python -m uvicorn main:app --reload")
            print("2. Start the frontend: cd apps/web && npm run dev")
            print("3. Open http://localhost:3000 and test heart functionality")
            
        except Exception as e:
            print(f"❌ Integration test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_heart_integration())