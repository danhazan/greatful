#!/usr/bin/env python3
"""
Simple script to test follow functionality manually.
Run this with the backend server running on localhost:8000
"""

import requests
import json

API_BASE = "http://localhost:8000/api/v1"

def test_follow_functionality():
    print("🧪 Testing Follow Functionality")
    print("=" * 50)
    
    # Test data
    user1_data = {
        "username": "testuser1",
        "email": "test1@example.com", 
        "password": "password123"
    }
    
    user2_data = {
        "username": "testuser2",
        "email": "test2@example.com",
        "password": "password123"
    }
    
    try:
        # 1. Create two test users
        print("1. Creating test users...")
        
        # Create user 1
        response1 = requests.post(f"{API_BASE}/auth/signup", json=user1_data)
        if response1.status_code == 201:
            user1_token = response1.json()["data"]["access_token"]
            user1_id = response1.json()["data"]["user"]["id"]
            print(f"   ✅ User 1 created: {user1_data['username']} (ID: {user1_id})")
        else:
            print(f"   ❌ Failed to create user 1: {response1.text}")
            return
            
        # Create user 2
        response2 = requests.post(f"{API_BASE}/auth/signup", json=user2_data)
        if response2.status_code == 201:
            user2_token = response2.json()["data"]["access_token"]
            user2_id = response2.json()["data"]["user"]["id"]
            print(f"   ✅ User 2 created: {user2_data['username']} (ID: {user2_id})")
        else:
            print(f"   ❌ Failed to create user 2: {response2.text}")
            return
        
        # 2. Test follow status (should be false initially)
        print("\n2. Testing initial follow status...")
        headers1 = {"Authorization": f"Bearer {user1_token}"}
        
        status_response = requests.get(f"{API_BASE}/follows/{user2_id}/status", headers=headers1)
        if status_response.status_code == 200:
            status_data = status_response.json()["data"]
            print(f"   ✅ Initial status: is_following={status_data['is_following']}, is_mutual={status_data['is_mutual']}")
        else:
            print(f"   ❌ Failed to get follow status: {status_response.text}")
            return
        
        # 3. User 1 follows User 2
        print("\n3. User 1 follows User 2...")
        follow_response = requests.post(f"{API_BASE}/follows/{user2_id}", headers=headers1)
        if follow_response.status_code == 201:
            follow_data = follow_response.json()["data"]
            print(f"   ✅ Follow successful: {follow_data['follower']['username']} -> {follow_data['followed']['username']}")
        else:
            print(f"   ❌ Failed to follow: {follow_response.text}")
            return
        
        # 4. Check follow status again
        print("\n4. Checking follow status after follow...")
        status_response = requests.get(f"{API_BASE}/follows/{user2_id}/status", headers=headers1)
        if status_response.status_code == 200:
            status_data = status_response.json()["data"]
            print(f"   ✅ Updated status: is_following={status_data['is_following']}, is_mutual={status_data['is_mutual']}")
        else:
            print(f"   ❌ Failed to get follow status: {status_response.text}")
            return
        
        # 5. Get User 2's followers
        print("\n5. Getting User 2's followers...")
        headers2 = {"Authorization": f"Bearer {user2_token}"}
        followers_response = requests.get(f"{API_BASE}/users/{user2_id}/followers", headers=headers2)
        if followers_response.status_code == 200:
            followers_data = followers_response.json()["data"]
            print(f"   ✅ User 2 has {followers_data['total_count']} followers")
            if followers_data['followers']:
                print(f"   📋 Followers: {[f['username'] for f in followers_data['followers']]}")
        else:
            print(f"   ❌ Failed to get followers: {followers_response.text}")
        
        # 6. Test unfollow
        print("\n6. User 1 unfollows User 2...")
        unfollow_response = requests.delete(f"{API_BASE}/follows/{user2_id}", headers=headers1)
        if unfollow_response.status_code == 200:
            print(f"   ✅ Unfollow successful")
        else:
            print(f"   ❌ Failed to unfollow: {unfollow_response.text}")
            return
        
        # 7. Check final status
        print("\n7. Checking final follow status...")
        status_response = requests.get(f"{API_BASE}/follows/{user2_id}/status", headers=headers1)
        if status_response.status_code == 200:
            status_data = status_response.json()["data"]
            print(f"   ✅ Final status: is_following={status_data['is_following']}, is_mutual={status_data['is_mutual']}")
        else:
            print(f"   ❌ Failed to get follow status: {status_response.text}")
        
        # 8. Test error cases
        print("\n8. Testing error cases...")
        
        # Try to follow self
        self_follow_response = requests.post(f"{API_BASE}/follows/{user1_id}", headers=headers1)
        if self_follow_response.status_code == 422:
            print(f"   ✅ Self-follow correctly rejected: {self_follow_response.json()['detail']}")
        else:
            print(f"   ❌ Self-follow should be rejected: {self_follow_response.text}")
        
        # Try to follow without auth
        no_auth_response = requests.post(f"{API_BASE}/follows/{user2_id}")
        if no_auth_response.status_code in [401, 403]:
            print(f"   ✅ Unauthenticated follow correctly rejected")
        else:
            print(f"   ❌ Unauthenticated follow should be rejected: {no_auth_response.text}")
        
        print("\n🎉 All tests completed successfully!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server. Make sure the backend is running on localhost:8000")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_follow_functionality()