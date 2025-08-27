// Simple test to check if getImageUrl works correctly

// Simulate the function
const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

const getImageUrl = (relativeUrl) => {
  if (!relativeUrl) return null
  
  // If it's already an absolute URL, return as is
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl
  }
  
  // If it's a relative URL, prepend the backend base URL
  return `${getApiBaseUrl()}${relativeUrl}`
}

console.log('Testing getImageUrl function:');
console.log('Relative URL:', getImageUrl('/uploads/posts/test.png'));
console.log('Absolute URL:', getImageUrl('http://example.com/test.png'));
console.log('Null URL:', getImageUrl(null));
console.log('Undefined URL:', getImageUrl(undefined));