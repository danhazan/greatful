'use client'

import React from 'react'
import { splitContentWithMentions, ContentPart } from '@/utils/mentionUtils'

interface MentionHighlighterProps {
  content: string
  className?: string
  onMentionClick?: (username: string) => void
  validUsernames?: string[]
}

/**
 * Component that renders text content with @username mentions highlighted
 * and clickable for navigation to user profiles
 */
export default function MentionHighlighter({
  content,
  className = '',
  onMentionClick,
  validUsernames
}: MentionHighlighterProps) {
  if (!content) {
    return <span className={className}></span>
  }

  const parts = splitContentWithMentions(content, validUsernames)

  return (
    <span className={className}>
      {parts.map((part: ContentPart, index: number) => {
        if (part.isMention && part.username) {
          return (
            <span
              key={index}
              className="mention text-purple-600 font-medium hover:text-purple-700 hover:underline cursor-pointer transition-colors"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onMentionClick?.(part.username!)
              }}
              title={`View @${part.username}'s profile`}
            >
              {part.text}
            </span>
          )
        }
        
        return (
          <span key={index}>
            {part.text}
          </span>
        )
      })}
    </span>
  )
}