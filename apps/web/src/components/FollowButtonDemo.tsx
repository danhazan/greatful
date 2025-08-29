'use client'

import React, { useState } from 'react'
import FollowButton from './FollowButton'

export default function FollowButtonDemo() {
  const [followState, setFollowState] = useState<{ [key: number]: boolean }>({})

  const handleFollowChange = (userId: number, isFollowing: boolean) => {
    setFollowState(prev => ({ ...prev, [userId]: isFollowing }))
    console.log(`User ${userId} follow state changed to: ${isFollowing}`)
  }

  const demoUsers = [
    { id: 1, name: 'Alice Johnson', bio: 'Gratitude enthusiast and mindfulness coach' },
    { id: 2, name: 'Bob Smith', bio: 'Daily gratitude practitioner' },
    { id: 3, name: 'Carol Davis', bio: 'Spreading positivity one post at a time' },
  ]

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">FollowButton Component Demo</h2>
        <p className="text-gray-600">
          Interactive demonstration of the FollowButton component with optimistic updates and loading states.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Variants</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Primary Variant (Large)</h4>
              <p className="text-sm text-gray-600">Default styling with purple background</p>
            </div>
            <FollowButton 
              userId={1} 
              size="lg" 
              variant="primary"
              onFollowChange={(isFollowing) => handleFollowChange(1, isFollowing)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Secondary Variant (Medium)</h4>
              <p className="text-sm text-gray-600">Light purple background with darker text</p>
            </div>
            <FollowButton 
              userId={2} 
              size="md" 
              variant="secondary"
              onFollowChange={(isFollowing) => handleFollowChange(2, isFollowing)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Outline Variant (Small)</h4>
              <p className="text-sm text-gray-600">Transparent background with purple border</p>
            </div>
            <FollowButton 
              userId={3} 
              size="sm" 
              variant="outline"
              onFollowChange={(isFollowing) => handleFollowChange(3, isFollowing)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Extra Small</h4>
              <p className="text-sm text-gray-600">Compact size for inline placement</p>
            </div>
            <FollowButton 
              userId={4} 
              size="xs" 
              variant="outline"
              onFollowChange={(isFollowing) => handleFollowChange(4, isFollowing)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Extra Extra Small (PostCard Size)</h4>
              <p className="text-sm text-gray-600">Ultra compact size - 50% smaller</p>
            </div>
            <FollowButton 
              userId={5} 
              size="xxs" 
              variant="outline"
              onFollowChange={(isFollowing) => handleFollowChange(5, isFollowing)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Cards with Follow Buttons</h3>
        
        <div className="space-y-4">
          {demoUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-lg">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{user.name}</h4>
                  <p className="text-sm text-gray-600">{user.bio}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {followState[user.id] ? 'Following' : 'Not following'}
                  </p>
                </div>
              </div>
              <FollowButton 
                userId={user.id} 
                size="md" 
                variant="primary"
                onFollowChange={(isFollowing) => handleFollowChange(user.id, isFollowing)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Features Demonstrated:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Optimistic Updates:</strong> UI updates immediately on click</li>
          <li>• <strong>Loading States:</strong> Shows spinner and disables button during API calls</li>
          <li>• <strong>Error Handling:</strong> Displays error messages with dismiss option</li>
          <li>• <strong>Multiple Variants:</strong> Primary, secondary, and outline styles</li>
          <li>• <strong>Responsive Sizes:</strong> Small, medium, and large button sizes</li>
          <li>• <strong>Accessibility:</strong> Proper ARIA labels and keyboard navigation</li>
          <li>• <strong>State Management:</strong> Tracks follow status and updates accordingly</li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">Usage Notes:</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Requires authentication token in localStorage</li>
          <li>• Automatically fetches initial follow status on mount</li>
          <li>• Handles various error states (401, 404, 409, 422, 500)</li>
          <li>• Prevents self-following through backend validation</li>
          <li>• Integrates with existing follow API endpoints</li>
        </ul>
      </div>
    </div>
  )
}