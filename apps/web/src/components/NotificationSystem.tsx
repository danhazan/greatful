"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { handleNotificationClick } from "@/utils/notificationLinks"

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
  createdAt?: string
  lastUpdatedAt?: string
  read: boolean
  // Batching fields
  isBatch?: boolean
  batchCount?: number
  parentId?: string | null
}

interface NotificationSystemProps {
  userId: string | number
}

export default function NotificationSystem({ userId }: NotificationSystemProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [batchChildren, setBatchChildren] = useState<Record<string, Notification[]>>({})
  const [currentTime, setCurrentTime] = useState(new Date())





  // Update current time every minute for live relative time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [])

  // Fetch notifications on mount and periodically
  useEffect(() => {
    if (!userId) return

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('No access token found for notifications')
          }
          return
        }

        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          
          // Debug logging in development
          if (process.env.NODE_ENV === 'development' && data.length > 0) {
            console.debug('Notification data sample:', data[0])
            console.debug('All notification timestamps:', data.map((n: any) => ({
              id: n.id,
              createdAt: n.createdAt,
              lastUpdatedAt: n.lastUpdatedAt
            })))
          }
          
          setNotifications(data)
          
          const unreadCount = data.filter((n: Notification) => !n.read).length
          setUnreadCount(unreadCount)
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.debug('Failed to fetch notifications:', response.status, await response.text())
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Failed to fetch notifications:', error)
        }
      }
    }

    // Fetch immediately
    fetchNotifications()

    // Set up periodic fetching every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    return () => clearInterval(interval)
  }, [userId])

  const markAsRead = async (notificationId: string) => {
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for notification read status')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for notification sync:', error)
      }
    }
  }

  const markAllAsRead = async () => {
    // Update local state immediately
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for mark all notifications as read')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for notification sync:', error)
      }
    }
  }

  const toggleBatchExpansion = async (batchId: string) => {
    const isExpanded = expandedBatches.has(batchId)
    
    if (isExpanded) {
      // Collapse the batch
      setExpandedBatches(prev => {
        const newSet = new Set(prev)
        newSet.delete(batchId)
        return newSet
      })
    } else {
      // Expand the batch - fetch children if not already loaded
      if (!batchChildren[batchId]) {
        try {
          const token = localStorage.getItem("access_token")
          if (!token) return

          const response = await fetch(`/api/notifications/${batchId}/children`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const children = await response.json()
            setBatchChildren(prev => ({
              ...prev,
              [batchId]: children
            }))
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('Failed to fetch batch children:', error)
          }
          return // Don't expand if we can't fetch children
        }
      }
      
      // Expand the batch
      setExpandedBatches(prev => {
        const newSet = new Set(prev)
        newSet.add(batchId)
        return newSet
      })
    }
  }



  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return "Unknown time"
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Invalid date"
    
    // Use currentTime state instead of new Date() for live updates
    const diffInMinutes = (currentTime.getTime() - date.getTime()) / (1000 * 60)
    
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
          className="relative p-2 text-purple-600 hover:text-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          aria-expanded={showNotifications}
          aria-haspopup="true"
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
            <span 
              className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div 
            className="fixed mt-2 w-80 sm:w-96 max-w-[calc(100vw-32px)] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[70vh] sm:max-h-96 overflow-hidden" 
            style={{
              top: '73px',
              right: '16px',
              left: 'auto'
            }}
            role="region"
            aria-label="Notifications panel"
            aria-live="polite"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-purple-600 hover:text-purple-700 px-2 py-1 min-h-[32px] touch-manipulation active:text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                    aria-label={`Mark all ${unreadCount} notifications as read`}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label="Close notifications panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div 
              className="max-h-[50vh] sm:max-h-80 overflow-y-auto custom-scrollbar"
              role="list"
              aria-label="Notification items"
            >
              {notifications.length === 0 ? (
                <div className="p-6 sm:p-8 text-center" role="status" aria-label="No notifications">
                  <div className="text-gray-400 text-4xl mb-2" aria-hidden="true">🔔</div>
                  <p className="text-gray-500">No notifications yet</p>
                  <p className="text-sm text-gray-400 mt-1">You'll see reactions and comments here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Array.isArray(notifications) && notifications.map((notification) => (
                    <div key={notification.id}>
                      {/* Main notification */}
                      <div
                        className={`p-4 sm:p-5 hover:bg-gray-50 cursor-pointer transition-colors min-h-[60px] touch-manipulation active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
                          !notification.read ? 'bg-purple-50' : ''
                        }`}
                        onClick={() => {
                          handleNotificationClick(notification, {
                            markAsRead,
                            toggleBatchExpansion,
                            navigate: (url: string) => router.push(url),
                            closeDropdown: () => setShowNotifications(false)
                          })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.currentTarget.click()
                          }
                        }}
                        role="listitem"
                        tabIndex={0}
                        aria-label={`${notification.isBatch ? 'Batch notification' : 'Notification'}: ${notification.message}. ${!notification.read ? 'Unread.' : 'Read.'} ${notification.isBatch ? 'Press to expand or collapse.' : 'Press to view post.'}`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* User Avatar or Batch Icon */}
                          <div className="flex-shrink-0">
                            {notification.isBatch ? (
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 text-xs font-medium">
                                  {notification.batchCount}
                                </span>
                              </div>
                            ) : notification.fromUser?.image ? (
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                                <img
                                  src={notification.fromUser?.image}
                                  alt={notification.fromUser?.name}
                                  className="w-full h-full object-cover object-center"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 text-sm font-medium">
                                  {notification.fromUser?.name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notification Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              {notification.isBatch ? (
                                notification.message
                              ) : (
                                <>
                                  <span className="font-medium">{notification.fromUser?.name}</span>
                                  {' '}
                                  {notification.message}
                                </>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatTime(notification.lastUpdatedAt || notification.createdAt)}
                            </p>
                          </div>

                          {/* Expand/Collapse indicator for batches */}
                          {notification.isBatch && (
                            <div className="flex-shrink-0">
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  expandedBatches.has(notification.id) ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          )}

                          {/* Unread Indicator */}
                          {!notification.read && (
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Batch children */}
                      {notification.isBatch && expandedBatches.has(notification.id) && batchChildren[notification.id] && Array.isArray(batchChildren[notification.id]) && (
                        <div className="bg-gray-50 max-h-60 overflow-y-auto border-l-4 border-purple-200 ml-4 custom-scrollbar" style={{ direction: 'rtl' }}>
                          {batchChildren[notification.id].map((child) => (
                            <div
                              key={child.id}
                              className="pl-4 pr-4 py-3 sm:py-4 hover:bg-gray-100 cursor-pointer transition-colors min-h-[56px] touch-manipulation active:bg-gray-200"
                              style={{ direction: 'ltr' }}
                              onClick={() => {
                                handleNotificationClick(child, {
                                  markAsRead,
                                  toggleBatchExpansion,
                                  navigate: (url: string) => router.push(url),
                                  closeDropdown: () => setShowNotifications(false)
                                })
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                {/* Child User Avatar */}
                                <div className="flex-shrink-0">
                                  {child.fromUser?.image ? (
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                                      <img
                                        src={child.fromUser?.image}
                                        alt={child.fromUser?.name}
                                        className="w-full h-full object-cover object-center"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                      <span className="text-purple-600 text-xs font-medium">
                                        {child.fromUser?.name?.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Child Content */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">{child.fromUser?.name}</span>
                                    {' '}
                                    {child.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatTime(child.lastUpdatedAt || child.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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