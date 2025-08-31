/**
 * Integration test for heart functionality
 * This tests the complete heart flow from frontend to backend
 */

const API_BASE_URL = 'http://localhost:8000'

async function testHeartFunctionality() {
  console.log('🧪 Testing Heart Functionality Integration...')
  
  try {
    // 1. Test that backend is running
    console.log('1. Checking backend health...')
    const healthResponse = await fetch(`${API_BASE_URL}/health`)
    if (!healthResponse.ok) {
      throw new Error('Backend is not running')
    }
    console.log('✅ Backend is healthy')
    
    // 2. Create a test user (signup)
    console.log('2. Creating test user...')
    const signupResponse = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123'
      })
    })
    
    if (!signupResponse.ok) {
      const errorData = await signupResponse.json()
      throw new Error(`Failed to create user: ${errorData.detail || 'Unknown error'}`)
    }
    
    const userData = await signupResponse.json()
    const token = userData.data.access_token
    console.log('✅ Test user created')
    
    // 3. Create a test post
    console.log('3. Creating test post...')
    const postResponse = await fetch(`${API_BASE_URL}/api/v1/posts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Test post for heart functionality',
        post_type: 'spontaneous'
      })
    })
    
    if (!postResponse.ok) {
      const errorData = await postResponse.json()
      throw new Error(`Failed to create post: ${errorData.detail || 'Unknown error'}`)
    }
    
    const postData = await postResponse.json()
    const postId = postData.id
    console.log('✅ Test post created:', postId)
    
    // 4. Test hearting the post (POST)
    console.log('4. Testing heart post...')
    const heartResponse = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/heart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!heartResponse.ok) {
      const errorData = await heartResponse.json()
      throw new Error(`Failed to heart post: ${errorData.detail || 'Unknown error'}`)
    }
    
    const heartData = await heartResponse.json()
    console.log('✅ Post hearted successfully:', heartData)
    
    // Verify the heart was added
    if (heartData.hearts_count !== 1) {
      throw new Error(`Expected hearts_count to be 1, got ${heartData.hearts_count}`)
    }
    if (heartData.is_hearted !== true) {
      throw new Error(`Expected is_hearted to be true, got ${heartData.is_hearted}`)
    }
    
    // 5. Test unhearting the post (DELETE)
    console.log('5. Testing unheart post...')
    const unheartResponse = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/heart`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!unheartResponse.ok) {
      const errorData = await unheartResponse.json()
      throw new Error(`Failed to unheart post: ${errorData.detail || 'Unknown error'}`)
    }
    
    // DELETE should return 200 OK with updated data
    if (unheartResponse.status !== 200) {
      throw new Error(`Expected 200 status, got ${unheartResponse.status}`)
    }
    
    const unheartData = await unheartResponse.json()
    if (unheartData.hearts_count !== 0) {
      throw new Error(`Expected hearts_count to be 0 after unheart, got ${unheartData.hearts_count}`)
    }
    if (unheartData.is_hearted !== false) {
      throw new Error(`Expected is_hearted to be false after unheart, got ${unheartData.is_hearted}`)
    }
    console.log('✅ Post unhearted successfully')
    
    // 6. Verify the heart was removed by checking the post
    console.log('6. Verifying heart was removed...')
    const feedResponse = await fetch(`${API_BASE_URL}/api/v1/posts/feed`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })
    
    if (!feedResponse.ok) {
      throw new Error('Failed to fetch feed')
    }
    
    const feedData = await feedResponse.json()
    const testPost = feedData.find(p => p.id === postId)
    
    if (!testPost) {
      throw new Error('Test post not found in feed')
    }
    
    if (testPost.hearts_count !== 0) {
      throw new Error(`Expected hearts_count to be 0, got ${testPost.hearts_count}`)
    }
    if (testPost.is_hearted !== false) {
      throw new Error(`Expected is_hearted to be false, got ${testPost.is_hearted}`)
    }
    
    console.log('✅ Heart removal verified')
    
    // 7. Test duplicate heart (should not create duplicate)
    console.log('7. Testing duplicate heart prevention...')
    
    // Heart the post again
    await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/heart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
    
    // Try to heart again (should return 409 or handle gracefully)
    const duplicateHeartResponse = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/heart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
    
    // Should either return 409 Conflict or handle gracefully
    if (duplicateHeartResponse.status === 409) {
      console.log('✅ Duplicate heart properly rejected with 409')
    } else if (duplicateHeartResponse.ok) {
      // If it handles gracefully, verify count is still 1
      const duplicateData = await duplicateHeartResponse.json()
      if (duplicateData.hearts_count !== 1) {
        throw new Error(`Expected hearts_count to remain 1, got ${duplicateData.hearts_count}`)
      }
      console.log('✅ Duplicate heart handled gracefully')
    } else {
      throw new Error(`Unexpected response for duplicate heart: ${duplicateHeartResponse.status}`)
    }
    
    console.log('\n🎉 All heart functionality tests passed!')
    console.log('✅ Heart POST works correctly')
    console.log('✅ Heart DELETE works correctly')
    console.log('✅ Heart counts are accurate')
    console.log('✅ Heart status is properly tracked')
    console.log('✅ Duplicate hearts are handled properly')
    
  } catch (error) {
    console.error('\n❌ Heart functionality test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
testHeartFunctionality()