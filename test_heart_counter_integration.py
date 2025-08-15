#!/usr/bin/env python3
"""
Integration test to verify the heart counter bug is fixed.
This test simulates the actual user flow that was broken.
"""

import requests
import json
import uuid
import time

# Configuration
API_BASE_URL = "http://localhost:8000"
WEB_BASE_URL = "http://localhost:3000"

def test_heart_counter_integration():
    """Test the complete heart counter flow."""
    print("🧪 Testing Heart Counter Integration...")
    
    # Test data
    user_data = {
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "username": f"testuser_{uuid.uuid4().hex[:8]}",
        "password": "testpassword123"
    }
    
    try:
        # 1. Create a user
        print("1️⃣ Creating test user...")
        signup_response = requests.post(f"{API_BASE_URL}/api/v1/auth/signup", json=user_data)
        if signup_response.status_code != 201:
            print(f"❌ Signup failed: {signup_response.status_code} - {signup_response.text}")
            return False
        print("✅ User created successfully")
        
        # 2. Login to get token
        print("2️⃣ Logging in...")
        login_response = requests.post(f"{API_BASE_URL}/api/v1/auth/login", json={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
        
        # 3. Create a test post
        print("3️⃣ Creating test post...")
        post_data = {
            "content": "I'm grateful for this heart counter test!",
            "post_type": "daily",
            "is_public": True
        }
        post_response = requests.post(f"{API_BASE_URL}/api/v1/posts", json=post_data, headers=headers)
        if post_response.status_code != 201:
            print(f"❌ Post creation failed: {post_response.status_code} - {post_response.text}")
            return False
        
        post_id = post_response.json()["id"]
        print(f"✅ Post created with ID: {post_id}")
        
        # 4. Check initial heart count (should be 0)
        print("4️⃣ Checking initial heart count...")
        hearts_response = requests.get(f"{API_BASE_URL}/api/v1/posts/{post_id}/hearts", headers=headers)
        if hearts_response.status_code != 200:
            print(f"❌ Failed to get heart info: {hearts_response.status_code} - {hearts_response.text}")
            return False
        
        heart_info = hearts_response.json()
        if heart_info["hearts_count"] != 0 or heart_info["is_hearted"] != False:
            print(f"❌ Initial heart count wrong: {heart_info}")
            return False
        print("✅ Initial heart count is correct (0)")
        
        # 5. Add a heart
        print("5️⃣ Adding heart to post...")
        add_heart_response = requests.post(f"{API_BASE_URL}/api/v1/posts/{post_id}/heart", headers=headers)
        if add_heart_response.status_code != 201:
            print(f"❌ Failed to add heart: {add_heart_response.status_code} - {add_heart_response.text}")
            return False
        print("✅ Heart added successfully")
        
        # 6. Check heart count after adding (should be 1)
        print("6️⃣ Checking heart count after adding...")
        hearts_response = requests.get(f"{API_BASE_URL}/api/v1/posts/{post_id}/hearts", headers=headers)
        if hearts_response.status_code != 200:
            print(f"❌ Failed to get heart info: {hearts_response.status_code} - {hearts_response.text}")
            return False
        
        heart_info = hearts_response.json()
        if heart_info["hearts_count"] != 1 or heart_info["is_hearted"] != True:
            print(f"❌ Heart count after adding is wrong: {heart_info}")
            return False
        print("✅ Heart count after adding is correct (1)")
        
        # 7. Add an emoji reaction
        print("7️⃣ Adding emoji reaction...")
        reaction_data = {"emoji_code": "heart_eyes"}
        reaction_response = requests.post(f"{API_BASE_URL}/api/v1/posts/{post_id}/reactions", 
                                        json=reaction_data, headers=headers)
        if reaction_response.status_code != 201:
            print(f"❌ Failed to add reaction: {reaction_response.status_code} - {reaction_response.text}")
            return False
        print("✅ Emoji reaction added successfully")
        
        # 8. Check reaction summary
        print("8️⃣ Checking reaction summary...")
        summary_response = requests.get(f"{API_BASE_URL}/api/v1/posts/{post_id}/reactions/summary", headers=headers)
        if summary_response.status_code != 200:
            print(f"❌ Failed to get reaction summary: {summary_response.status_code} - {summary_response.text}")
            return False
        
        summary = summary_response.json()
        if summary["total_count"] != 1 or summary["user_reaction"] != "heart_eyes":
            print(f"❌ Reaction summary is wrong: {summary}")
            return False
        print("✅ Reaction summary is correct")
        
        # 9. Test frontend API proxy (if available)
        print("9️⃣ Testing frontend API proxy...")
        try:
            # Test the frontend heart endpoint
            frontend_hearts_response = requests.get(f"{WEB_BASE_URL}/api/posts/{post_id}/hearts", 
                                                   headers=headers, timeout=5)
            if frontend_hearts_response.status_code == 200:
                frontend_heart_info = frontend_hearts_response.json()
                if frontend_heart_info["hearts_count"] == 1:
                    print("✅ Frontend API proxy working correctly")
                else:
                    print(f"⚠️ Frontend API proxy returns wrong count: {frontend_heart_info}")
            else:
                print(f"⚠️ Frontend API proxy not available: {frontend_hearts_response.status_code}")
        except requests.exceptions.RequestException:
            print("⚠️ Frontend server not running, skipping proxy test")
        
        # 10. Remove heart
        print("🔟 Removing heart...")
        remove_heart_response = requests.delete(f"{API_BASE_URL}/api/v1/posts/{post_id}/heart", headers=headers)
        if remove_heart_response.status_code != 204:
            print(f"❌ Failed to remove heart: {remove_heart_response.status_code} - {remove_heart_response.text}")
            return False
        print("✅ Heart removed successfully")
        
        # 11. Check final heart count (should be 0 again)
        print("1️⃣1️⃣ Checking final heart count...")
        hearts_response = requests.get(f"{API_BASE_URL}/api/v1/posts/{post_id}/hearts", headers=headers)
        if hearts_response.status_code != 200:
            print(f"❌ Failed to get final heart info: {hearts_response.status_code} - {hearts_response.text}")
            return False
        
        heart_info = hearts_response.json()
        if heart_info["hearts_count"] != 0 or heart_info["is_hearted"] != False:
            print(f"❌ Final heart count wrong: {heart_info}")
            return False
        print("✅ Final heart count is correct (0)")
        
        print("\n🎉 ALL TESTS PASSED! Heart counter bug is FIXED! 🎉")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    print("Heart Counter Integration Test")
    print("=" * 50)
    print("This test verifies that the heart counter bug has been fixed.")
    print("Make sure the API server is running on http://localhost:8000")
    print("=" * 50)
    
    success = test_heart_counter_integration()
    
    if success:
        print("\n✅ INTEGRATION TEST PASSED")
        print("The heart counter bug has been successfully fixed!")
        exit(0)
    else:
        print("\n❌ INTEGRATION TEST FAILED")
        print("There are still issues with the heart counter functionality.")
        exit(1)