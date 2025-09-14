"use client"

import { useState } from "react"
import PostCard from "@/components/PostCard"

// Mock posts with different types and content to test toolbar alignment and RTL support
const mockPosts = [
  {
    id: "1",
    content: "Daily gratitude post with a longer content to test how the toolbar aligns when content wraps to multiple lines. This should maintain proper alignment.",
    author: {
      id: "1",
      name: "Alice Johnson",
      username: "alice",
      display_name: "Alice Johnson",
      image: "/api/placeholder/40/40"
    },
    createdAt: new Date().toISOString(),
    postType: "daily" as const,
    heartsCount: 15,
    isHearted: true,
    reactionsCount: 8,
    currentUserReaction: "heart_eyes",
    location: "San Francisco, CA",
    location_data: {
      display_name: "San Francisco, California",
      lat: 37.7749,
      lon: -122.4194,
      address: {
        city: "San Francisco",
        state: "California",
        country: "United States",
        country_code: "US"
      }
    }
  },
  {
    id: "2",
    content: "Photo post with image and shorter content.",
    author: {
      id: "2",
      name: "Bob Smith",
      username: "bob",
      display_name: "Bob Smith"
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    postType: "photo" as const,
    imageUrl: "/api/placeholder/400/300",
    heartsCount: 3,
    isHearted: false,
    reactionsCount: 2,
    location: "New York"
  },
  {
    id: "3",
    content: "Short spontaneous post",
    author: {
      id: "3",
      name: "Carol Davis",
      username: "carol",
      display_name: "Carol"
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    postType: "spontaneous" as const,
    heartsCount: 1,
    isHearted: false,
    reactionsCount: 0
  },
  {
    id: "4",
    content: "Post without location to test toolbar alignment when location button is not present. This should still maintain proper spacing and alignment.",
    author: {
      id: "4",
      name: "David Wilson",
      username: "david",
      display_name: "David Wilson"
    },
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    postType: "daily" as const,
    heartsCount: 25,
    isHearted: true,
    reactionsCount: 12,
    currentUserReaction: "pray"
  },
  {
    id: "5",
    content: "שלום! זה פוסט בעברית לבדיקת תמיכה ב-RTL. הטקסט צריך להיות מיושר לימין והכיוון צריך להיות נכון.",
    author: {
      id: "5",
      name: "שרה כהן",
      username: "sarah_hebrew",
      display_name: "שרה כהן"
    },
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    postType: "daily" as const,
    heartsCount: 8,
    isHearted: false,
    reactionsCount: 3,
    location: "תל אביב, ישראל"
  },
  {
    id: "6",
    content: "Mixed content test: Hello world! שלום עולם! This post contains both English and Hebrew text to test mixed RTL/LTR content handling.",
    author: {
      id: "6",
      name: "Mixed User",
      username: "mixed_content",
      display_name: "Mixed User"
    },
    createdAt: new Date(Date.now() - 18000000).toISOString(),
    postType: "photo" as const,
    heartsCount: 5,
    isHearted: true,
    reactionsCount: 2,
    currentUserReaction: "star"
  },
  {
    id: "7",
    content: "مرحبا! هذا منشور باللغة العربية لاختبار دعم RTL. يجب أن يكون النص محاذى إلى اليمين والاتجاه صحيح.",
    author: {
      id: "7",
      name: "أحمد محمد",
      username: "ahmed_arabic",
      display_name: "أحمد محمد"
    },
    createdAt: new Date(Date.now() - 21600000).toISOString(),
    postType: "spontaneous" as const,
    heartsCount: 12,
    isHearted: false,
    reactionsCount: 6,
    location: "دبي، الإمارات العربية المتحدة"
  }
]

export default function TestToolbarPage() {
  const [posts, setPosts] = useState(mockPosts)

  const handleHeart = (postId: string, isCurrentlyHearted: boolean) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            isHearted: !isCurrentlyHearted,
            heartsCount: isCurrentlyHearted ? post.heartsCount - 1 : post.heartsCount + 1
          } as typeof post
        : post
    ))
  }

  const handleReaction = (postId: string, emojiCode: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            currentUserReaction: emojiCode,
            reactionsCount: post.currentUserReaction ? post.reactionsCount : post.reactionsCount + 1
          } as typeof post
        : post
    ))
  }

  const handleRemoveReaction = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            currentUserReaction: undefined,
            reactionsCount: Math.max(0, post.reactionsCount - 1)
          } as typeof post
        : post
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PostCard Toolbar Alignment & RTL Test
          </h1>
          <p className="text-gray-600">
            Testing toolbar alignment across different post types, screen sizes, and RTL language support
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>• Resize your browser window to test responsive behavior</p>
            <p>• Check that all buttons maintain 44px minimum touch targets</p>
            <p>• Verify consistent spacing and alignment</p>
            <p>• Test RTL text alignment for Hebrew and Arabic posts</p>
            <p>• Check mixed LTR/RTL content handling</p>
          </div>
        </div>

        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId="1"
              onHeart={handleHeart}
              onReaction={handleReaction}
              onRemoveReaction={handleRemoveReaction}
              onShare={(postId) => console.log('Share:', postId)}
              onUserClick={(userId) => console.log('User click:', userId)}
            />
          ))}
        </div>

        {/* Mobile and RTL test section */}
        <div className="mt-12 p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Mobile & RTL Testing Guide</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>All buttons should have minimum 44px touch targets</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Icons should be properly aligned and not overlap</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Count numbers should hide on very small screens (xs breakpoint)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Location button should truncate text properly</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Share button text should hide on small screens</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Hebrew and Arabic text should align to the right</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Mixed content should handle direction changes properly</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>RTL usernames and locations should display correctly</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Mentions (@username) should work in RTL text</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}