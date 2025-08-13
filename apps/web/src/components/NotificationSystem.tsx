"use client"

import { useState, useEffect } from "react"
import { X, Heart, MessageCircle } from "lucide-react"

interface Notification {
  id: string
  type: 'reaction' | 'comment' | 'share'
  message: string
  postId: string
  fromUser: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  read: boolean
}

interface NotificationSystemProps {
  userId: string
}

export default function NotificationSystem({ userId }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch notifications on mount and periodically
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) return

        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const notificationsData = await response.json()
          setNotifications(notificationsData)
          setUnreadCount(notificationsData.filter((n: Notification) => !n.read).length)
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
      }
    }

    fetchNotifications()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [userId])

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reaction':
        return <Heart className="h-4 w-4 text-red-500" />
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-500" />
      default:
        return <Heart className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60)
    
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-gray-600 hover:text-purple-600 transition-colors"
          aria-label="Notifications"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-2">🔔</div>
                  <p className="text-gray-500">No notifications yet</p>
                  <p className="text-sm text-gray-400 mt-1">You'll see reactions and comments here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-purple-50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id)
                        }
                        // Navigate to post (you can implement this)
                        setShowNotifications(false)
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                          {notification.fromUser.image ? (
                            <img
                              src={notification.fromUser.image}
                              alt={notification.fromUser.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 text-sm font-medium">
                                {notification.fromUser.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Notification Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {getNotificationIcon(notification.type)}
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">{notification.fromUser.name}</span>
                              {' '}
                              {notification.message}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>

                        {/* Unread Indicator */}
                        {!notification.read && (
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </>
  )
}