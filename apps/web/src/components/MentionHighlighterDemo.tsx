'use client'

import React, { useState } from 'react'
import MentionHighlighter from './MentionHighlighter'

/**
 * Demo component to showcase the MentionHighlighter functionality
 */
export default function MentionHighlighterDemo() {
  const [content, setContent] = useState('Hey @alice and @bob, check out this amazing post by @charlie!')

  const sampleTexts = [
    'Hello @john, how are you today?',
    'Thanks @sarah for the help! @mike you should see this too.',
    '@everyone please join the meeting at 3pm',
    'No mentions in this text',
    'Contact @support_team or @admin_user for assistance',
    '@user123 @test_user @another_user multiple mentions here',
    'Mixed content with @username and regular text',
    'Consecutive @alice@bob@charlie mentions'
  ]

  const handleMentionClick = (username: string) => {
    alert(`Clicked on mention: @${username}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Mention Highlighter Demo
        </h2>
        <p className="text-gray-600 mb-6">
          This demo shows how @username mentions are detected and highlighted in post content.
          Click on any highlighted mention to see the interaction.
        </p>

        {/* Interactive Input */}
        <div className="mb-6">
          <label htmlFor="content-input" className="block text-sm font-medium text-gray-700 mb-2">
            Try your own text with @username mentions:
          </label>
          <textarea
            id="content-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            rows={3}
            placeholder="Type some text with @username mentions..."
          />
        </div>

        {/* Live Preview */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Preview:</h3>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <MentionHighlighter
              content={content}
              onMentionClick={handleMentionClick}
              className="text-gray-900"
            />
          </div>
        </div>

        {/* Sample Texts */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Sample Texts:</h3>
          <div className="space-y-3">
            {sampleTexts.map((text, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">Sample {index + 1}:</div>
                <MentionHighlighter
                  content={text}
                  onMentionClick={handleMentionClick}
                  className="text-gray-900"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Test Buttons */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Tests:</h3>
          <div className="flex flex-wrap gap-2">
            {sampleTexts.map((text, index) => (
              <button
                key={index}
                onClick={() => setContent(text)}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
              >
                Sample {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Technical Details:</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Regex Pattern:</strong> <code>/@([a-zA-Z0-9_]+)/g</code></p>
          <p><strong>Valid Characters:</strong> Letters, numbers, and underscores</p>
          <p><strong>Styling:</strong> Purple color with hover effects</p>
          <p><strong>Interaction:</strong> Click mentions to trigger navigation</p>
          <p><strong>Accessibility:</strong> Proper title attributes and keyboard support</p>
        </div>
      </div>
    </div>
  )
}