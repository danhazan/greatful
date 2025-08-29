'use client'

import React from 'react'
import PostCard from './PostCard'

export default function PostCardLayoutDemo() {
  const mockPost = {
    id: 'demo-post-1',
    content: 'This is a demo post showing the new FollowButton placement. The button should appear right next to the profile photo, above the date display.',
    author: {
      id: '123',
      name: 'Demo User',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    createdAt: new Date().toISOString(),
    postType: 'daily' as const,
    heartsCount: 5,
    isHearted: false,
    reactionsCount: 3,
    currentUserReaction: undefined
  }

  const mockHandlers = {
    onHeart: (postId: string, isCurrentlyHearted: boolean) => {
      console.log('Heart clicked:', postId, isCurrentlyHearted)
    },
    onReaction: (postId: string, emojiCode: string) => {
      console.log('Reaction clicked:', postId, emojiCode)
    },
    onRemoveReaction: (postId: string) => {
      console.log('Reaction removed:', postId)
    },
    onShare: (postId: string) => {
      console.log('Share clicked:', postId)
    },
    onUserClick: (userId: string) => {
      console.log('User clicked:', userId)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">PostCard FollowButton Layout</h2>
        <p className="text-gray-600">
          The FollowButton is now positioned right next to the profile photo, above the date display.
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Layout (with FollowButton)</h3>
        <PostCard 
          post={mockPost} 
          currentUserId="current-user-456" // Different from post author to show follow button
          {...mockHandlers}
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Same User's Post (no FollowButton)</h3>
        <PostCard 
          post={mockPost} 
          currentUserId="123" // Same as post author, so no follow button
          {...mockHandlers}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Layout Changes:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>FollowButton Position:</strong> Horizontally inline with the username</li>
          <li>• <strong>Size:</strong> Extra small (xs) for compact inline placement</li>
          <li>• <strong>Variant:</strong> Outline style to be less prominent</li>
          <li>• <strong>Responsive:</strong> Maintains proper spacing on all screen sizes</li>
          <li>• <strong>Conditional:</strong> Only shows for other users' posts</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">Visual Hierarchy:</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Profile photo remains the primary visual anchor</li>
          <li>• Username is the main text element</li>
          <li>• FollowButton is secondary, positioned for easy access</li>
          <li>• Date and location info remain in their logical position</li>
          <li>• Post type badge stays in the top-right corner</li>
        </ul>
      </div>
    </div>
  )
}