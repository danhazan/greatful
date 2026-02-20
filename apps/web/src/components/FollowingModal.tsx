'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

import UserListItem from './UserListItem'
import { getAccessToken } from '@/utils/auth'

interface FollowingUser {
  id: number
  username: string
  displayName?: string
  bio?: string
  profileImageUrl?: string
  createdAt: string
}

interface FollowingModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string | number
  username: string
}

export default function FollowingModal({
  isOpen,
  onClose,
  userId,
  username
}: FollowingModalProps) {
  const [following, setFollowing] = useState<FollowingUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Fetch following when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchFollowing()
    }
  }, [isOpen, userId])

  const fetchFollowing = async () => {
    const token = getAccessToken()
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}/following?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch following')
      }

      const result = await response.json()
      const data = result.data || result
      setFollowing(data.following || [])
    } catch (error) {
      console.error('Error fetching following:', error)
      setError('Failed to load following')
    } finally {
      setIsLoading(false)
    }
  }



  const handleClose = () => {
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span className="text-lg">👤</span>
              <span>{username} is Following</span>
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close following modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">👤</div>
                <p className="text-gray-500">Loading following...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">😔</div>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => fetchFollowing()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : following.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">👤</div>
                <p className="text-gray-500">Not following anyone yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  {username} isn't following anyone yet.
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {following.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={{
                      id: user.id,
                      name: user.displayName || user.username,
                      username: user.username,
                      profileImageUrl: user.profileImageUrl,
                      bio: user.bio
                    }}
                    onClick={() => {
                      window.location.href = `/profile/${user.id}`
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}