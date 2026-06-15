"use client"

import { useState } from "react"
import { RotateCcw, UserPlus, X } from "lucide-react"

interface ResurrectionDialogProps {
  isOpen: boolean
  identity: string
  isLoading: boolean
  onRestore: () => void
  onStartFresh: () => void
  onClose: () => void
}

export default function ResurrectionDialog({
  isOpen,
  identity,
  isLoading,
  onRestore,
  onStartFresh,
  onClose,
}: ResurrectionDialogProps) {
  const [decision, setDecision] = useState<"restore" | "fresh" | null>(null)

  if (!isOpen) return null

  const handleRestore = () => {
    setDecision("restore")
    onRestore()
  }

  const handleStartFresh = () => {
    setDecision("fresh")
    onStartFresh()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Account Found</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">
            We found a deleted account associated with this{" "}
            <span className="font-semibold">{identity}</span>.
          </p>
          <p className="text-gray-700 mt-2">Would you like to restore that account or create a completely new one?</p>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl space-y-3">
          <button
            onClick={handleRestore}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && decision === "restore" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span>{isLoading && decision === "restore" ? "Restoring..." : "Restore Account"}</span>
          </button>
          <button
            onClick={handleStartFresh}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && decision === "fresh" ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            <span>{isLoading && decision === "fresh" ? "Creating..." : "Create New Account"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
