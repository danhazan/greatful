"use client"

import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning' | 'loading'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastNotificationProps {
  toast: Toast
  onClose: (id: string) => void
}

export default function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Ensure transition starts AFTER initial render commit
    let raf1 = requestAnimationFrame(() => {
      let raf2 = requestAnimationFrame(() => setIsVisible(true))
      // store nested id in closure to cancel properly
      ;(setIsVisible as any)._raf2 = raf2
    })
    return () => {
      cancelAnimationFrame(raf1)
      if ((setIsVisible as any)._raf2) cancelAnimationFrame((setIsVisible as any)._raf2)
    }
  }, [])

  useEffect(() => {
    if (toast.type === 'loading') return // Don't auto-close loading toasts

    const duration = toast.duration || (toast.type === 'error' ? 5000 : 3000)
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.duration, toast.type])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose(toast.id)
    }, 300)
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'loading':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const handleToastClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    handleClose()
  }

  return (
    <div
      className={`
        max-w-sm w-[min(100vw-1rem,24rem)]
        transition-all duration-300 ease-in-out will-change-transform
        ${isVisible && !isExiting ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}
      `}
      // Inline safety guards for rogue CSS
      style={{ transformOrigin: "right center" }}
    >
      <div 
        className={`
          rounded-lg border shadow-lg p-4 cursor-pointer relative ${getBackgroundColor()}
        `}
        onClick={handleToastClick}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="text-sm font-semibold text-gray-900 break-words">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="mt-1 text-sm text-gray-600 break-words">
                {toast.message}
              </p>
            )}
            {toast.action && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toast.action!.onClick()
                  }}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
          
          {toast.type !== 'loading' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}