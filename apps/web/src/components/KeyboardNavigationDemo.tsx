'use client'

import React, { useState } from 'react'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

interface DemoItem {
  id: number
  name: string
  description: string
}

export default function KeyboardNavigationDemo() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Generate a long list to test scrolling
  const items: DemoItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    description: `This is the description for item ${i + 1}. It demonstrates keyboard navigation with auto-scrolling.`
  }))

  const { setItemRef } = useKeyboardNavigation({
    isOpen,
    itemCount: items.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => {
      alert(`Selected: ${items[selectedIndex].name}`)
      setIsOpen(false)
    },
    onClose: () => setIsOpen(false),
    scrollBehavior: 'smooth'
  })

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Keyboard Navigation Demo
      </h2>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
      >
        {isOpen ? 'Close Dropdown' : 'Open Dropdown'}
      </button>

      {isOpen && (
        <div className="relative mt-2">
          <div
            role="listbox"
            aria-label="Demo items"
            className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={setItemRef(index)}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                className={`w-full px-4 py-3 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0 focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
                  index === selectedIndex ? 'bg-purple-50 text-purple-700' : 'text-gray-900'
                }`}
                onClick={() => {
                  alert(`Selected: ${item.name}`)
                  setIsOpen(false)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                aria-label={`Select ${item.name}. ${item.description}`}
              >
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-500 mt-1">{item.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-800 mb-2">Instructions:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click "Open Dropdown" to show the list</li>
          <li>• Use ↑/↓ arrow keys to navigate</li>
          <li>• Press Enter or Space to select</li>
          <li>• Press Escape to close</li>
          <li>• Use Home/End to jump to first/last item</li>
          <li>• Notice how the list auto-scrolls to keep the focused item visible</li>
        </ul>
      </div>
    </div>
  )
}