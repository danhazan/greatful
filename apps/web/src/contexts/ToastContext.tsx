"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'
import ToastNotification, { Toast } from '@/components/ToastNotification'
import ToastPortal from '@/contexts/ToastPortal'

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => string
  hideToast: (id: string) => void
  showSuccess: (title: string, message?: string) => string
  showError: (title: string, message?: string, action?: Toast['action']) => string
  showInfo: (title: string, message?: string) => string
  showWarning: (title: string, message?: string) => string
  showLoading: (title: string, message?: string) => string
  updateToast: (id: string, updates: Partial<Toast>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const generateId = () => Math.random().toString(36).substring(2, 11)

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId()
    const newToast: Toast = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
    return id
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ))
  }, [])

  const showSuccess = useCallback((title: string, message?: string) => {
    return showToast({ type: 'success', title, message })
  }, [showToast])

  const showError = useCallback((title: string, message?: string, action?: Toast['action']) => {
    return showToast({ type: 'error', title, message, action })
  }, [showToast])

  const showInfo = useCallback((title: string, message?: string) => {
    return showToast({ type: 'info', title, message })
  }, [showToast])

  const showWarning = useCallback((title: string, message?: string) => {
    return showToast({ type: 'warning', title, message })
  }, [showToast])

  const showLoading = useCallback((title: string, message?: string) => {
    return showToast({ type: 'loading', title, message })
  }, [showToast])

  const value: ToastContextType = {
    showToast,
    hideToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
    updateToast
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container (now portaled to <body>) */}
      <ToastPortal>
        <div
          className="
            p-4 space-y-2
            pointer-events-none
            flex flex-col items-end
            max-w-full
          "
          // inline safety in case Tailwind/global CSS conflicts
          style={{
            maxWidth: "100vw",
            boxSizing: "border-box",
          }}
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastNotification toast={toast} onClose={hideToast} />
            </div>
          ))}
        </div>
      </ToastPortal>
    </ToastContext.Provider>
  )
}