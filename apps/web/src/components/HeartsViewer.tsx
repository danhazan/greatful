"use client"

import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import { formatTimeAgo } from "@/utils/timeAgo"
import UserListItem from "./UserListItem"

interface HeartUser {
  id: string
  userId: string
  userName: string
  userImage?: string
  createdAt: string
}

interface HeartsViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  hearts: HeartUser[]
  onUserClick?: (userId: number) => void
}

export default function HeartsViewer({ isOpen, onClose, postId, hearts, onUserClick }: HeartsViewerProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Get total count
  const totalCount = hearts.length

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
              <span className="text-lg">💜</span>
              <span>Hearts ({totalCount})</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {totalCount === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">💜</div>
                <p className="text-gray-500">No hearts yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to heart this post!</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {hearts.map((heart) => (
                  <UserListItem
                    key={heart.id}
                    user={{
                      id: heart.userId,
                      name: heart.userName,
                      image: heart.userImage,
                      createdAt: heart.createdAt
                    }}
                    onClick={() => onUserClick?.(parseInt(heart.userId))}
                    showTimestamp={true}
                    rightElement={<span className="text-lg">💜</span>}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
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