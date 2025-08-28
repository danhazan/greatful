'use client'

import React, { useState, useRef } from 'react'
import MentionAutocomplete from './MentionAutocomplete'
import { UserInfo } from '@/../../shared/types/core'

export default function MentionAutocompleteDemo() {
  const [text, setText] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    
    setText(value)
    
    // Check if user typed @ and extract search query
    const textBeforeCursor = value.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (atMatch) {
      const query = atMatch[1]
      setSearchQuery(query)
      setShowAutocomplete(true)
      
      // Calculate position for dropdown
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect()
        setCursorPosition({
          x: rect.left + 10, // Approximate position
          y: rect.bottom + 5
        })
      }
    } else {
      setShowAutocomplete(false)
      setSearchQuery('')
    }
  }

  const handleUserSelect = (user: UserInfo) => {
    if (!textareaRef.current) return
    
    const cursorPos = textareaRef.current.selectionStart
    const textBeforeCursor = text.substring(0, cursorPos)
    const textAfterCursor = text.substring(cursorPos)
    
    // Find the @ symbol and replace with @username
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      const beforeAt = textBeforeCursor.substring(0, atMatch.index)
      const newText = beforeAt + `@${user.username} ` + textAfterCursor
      setText(newText)
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeAt.length + user.username.length + 2
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          textareaRef.current.focus()
        }
      }, 0)
    }
    
    setShowAutocomplete(false)
    setSearchQuery('')
  }

  const handleCloseAutocomplete = () => {
    setShowAutocomplete(false)
    setSearchQuery('')
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        MentionAutocomplete Demo
      </h2>
      
      <div className="mb-4">
        <label htmlFor="demo-textarea" className="block text-sm font-medium text-gray-700 mb-2">
          Type @ to mention users:
        </label>
        <textarea
          ref={textareaRef}
          id="demo-textarea"
          value={text}
          onChange={handleTextChange}
          placeholder="Try typing @test to see the autocomplete..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          rows={4}
        />
      </div>
      
      <div className="text-sm text-gray-600">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Type @ followed by a username to trigger autocomplete</li>
          <li>Use arrow keys to navigate suggestions</li>
          <li>Press Enter or click to select a user</li>
          <li>Press Escape to close the dropdown</li>
        </ul>
      </div>
      
      {showAutocomplete && (
        <MentionAutocomplete
          isOpen={showAutocomplete}
          searchQuery={searchQuery}
          onUserSelect={handleUserSelect}
          onClose={handleCloseAutocomplete}
          position={cursorPosition}
        />
      )}
    </div>
  )
}