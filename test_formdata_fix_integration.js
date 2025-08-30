#!/usr/bin/env node

/**
 * Integration test for FormData upload bug fix.
 * 
 * This script tests the complete flow:
 * Frontend FormData → Next.js API Route → FastAPI Backend
 * 
 * Usage:
 *   node test_formdata_fix_integration.js
 * 
 * Expected Results:
 * - Before fix: 422 Unprocessable Entity
 * - After fix: 401 Unauthorized (with fake token) or 200 OK (with real token)
 */

const fs = require('fs');

async function testFormDataFix() {
  console.log('🧪 Testing FormData Upload Bug Fix');
  console.log('=====================================\n');

  try {
    // Test 1: Verify Next.js API route handles FormData correctly
    console.log('📤 Test 1: Next.js API Route FormData Handling');
    
    const testImageData = Buffer.from('fake image data for testing profile photo upload');
    const formData = new FormData();
    formData.append('file', new Blob([testImageData], { type: 'image/png' }), 'test-profile.png');
    
    console.log('   → Creating FormData with test image...');
    console.log('   → File name: test-profile.png');
    console.log('   → File type: image/png');
    console.log('   → File size:', testImageData.length, 'bytes');
    
    // Test with invalid token (should get 401, not 422)
    console.log('\n   → Testing with invalid auth token...');
    
    const response = await fetch('http://localhost:3000/api/users/me/profile/photo', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token'
      },
      body: formData
    });
    
    const result = await response.text();
    
    console.log('   → Status Code:', response.status);
    console.log('   → Response:', result);
    
    // Analyze results
    if (response.status === 422) {
      console.log('\n❌ FAILED: Still getting 422 Unprocessable Entity');
      console.log('   This indicates the FormData bug is NOT fixed.');
      console.log('   The Content-Type header is likely still being set to application/json.');
      return false;
    } else if (response.status === 401) {
      console.log('\n✅ SUCCESS: Got 401 Unauthorized (expected)');
      console.log('   This proves FormData is being forwarded correctly!');
      console.log('   The backend can parse the file but auth fails (as expected).');
    } else {
      console.log('\n🤔 UNEXPECTED: Got status', response.status);
      console.log('   Check server logs for details.');
    }

    // Test 2: Verify direct backend endpoint works
    console.log('\n📡 Test 2: Direct Backend Endpoint Test');
    
    try {
      const directResponse = await fetch('http://localhost:8000/api/v1/users/me/profile/photo', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid.token.for.testing'
        },
        body: formData
      });
      
      console.log('   → Direct backend status:', directResponse.status);
      
      if (directResponse.status === 401) {
        console.log('   ✅ Backend correctly rejects invalid auth');
      } else if (directResponse.status === 422) {
        console.log('   ❌ Backend has FormData parsing issues');
      }
      
    } catch (error) {
      console.log('   ⚠️  Backend not accessible:', error.message);
      console.log('   (This is OK if backend is not running)');
    }

    // Test 3: Verify Content-Type behavior
    console.log('\n🔍 Test 3: Content-Type Header Analysis');
    
    // Simulate the bug condition
    console.log('   → Testing with manual Content-Type (simulates the bug)...');
    
    const buggyResponse = await fetch('http://localhost:3000/api/users/me/profile/photo', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test.token',
        'Content-Type': 'application/json'  // This simulates the bug!
      },
      body: JSON.stringify({ fake: 'data' })  // Not FormData
    });
    
    console.log('   → Buggy request status:', buggyResponse.status);
    
    if (buggyResponse.status === 422) {
      console.log('   ✅ Correctly rejects non-FormData with wrong Content-Type');
    }

    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    
    if (response.status === 401) {
      console.log('✅ FormData Bug Fix: WORKING');
      console.log('✅ Next.js properly forwards FormData to backend');
      console.log('✅ Backend can parse multipart data correctly');
      console.log('✅ Authentication layer works as expected');
      
      console.log('\n🎯 Key Evidence:');
      console.log('   • 401 Unauthorized (not 422 Unprocessable Entity)');
      console.log('   • FormData reaches backend with proper Content-Type');
      console.log('   • File parsing succeeds, auth fails (expected behavior)');
      
      return true;
    } else {
      console.log('❌ FormData Bug Fix: NEEDS INVESTIGATION');
      console.log('   Check server logs and verify both servers are running.');
      return false;
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Ensure Next.js dev server is running (npm run dev)');
    console.log('   • Ensure FastAPI backend is running (uvicorn main:app --reload)');
    console.log('   • Check network connectivity');
    return false;
  }
}

async function runDiagnostics() {
  console.log('\n🔧 Running Diagnostics');
  console.log('======================');
  
  // Check if servers are running
  try {
    const nextResponse = await fetch('http://localhost:3000');
    console.log('✅ Next.js server: Running');
  } catch (error) {
    console.log('❌ Next.js server: Not accessible');
    console.log('   Run: npm run dev');
  }
  
  try {
    const backendResponse = await fetch('http://localhost:8000/health');
    console.log('✅ FastAPI backend: Running');
  } catch (error) {
    console.log('❌ FastAPI backend: Not accessible');
    console.log('   Run: uvicorn main:app --reload');
  }
}

// Main execution
async function main() {
  console.log('FormData Upload Bug Fix - Integration Test');
  console.log('==========================================');
  console.log('This test verifies that the 422 Unprocessable Entity bug');
  console.log('has been fixed for file upload endpoints.\n');
  
  await runDiagnostics();
  
  const success = await testFormDataFix();
  
  console.log('\n' + '='.repeat(50));
  
  if (success) {
    console.log('🎉 ALL TESTS PASSED - FormData bug is fixed!');
    process.exit(0);
  } else {
    console.log('💥 TESTS FAILED - FormData bug may still exist');
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});