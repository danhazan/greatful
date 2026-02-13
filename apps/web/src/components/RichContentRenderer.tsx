"use client"

import { PostStyle } from "./PostStyleSelector"
import { useMemo } from 'react'
import "../styles/rich-content.css"
import { getTextDirectionFromPlainText } from "@/utils/rtlUtils"

// Safe DOMPurify usage for client-side only
function safeSanitize(html: string): string {
  if (typeof window === 'undefined') {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }

  try {
    const DOMPurify = require('dompurify')
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'u', 'span', 'br', 'p', 'div'],
      ALLOWED_ATTR: ['style', 'class', 'data-username']
    })
  } catch {
    return html
  }
}

interface RichContentRendererProps {
  content: string
  className?: string
  onMentionClick?: (username: string) => void
  validUsernames?: string[]
}

export default function RichContentRenderer({
  content,
  className = "",
  onMentionClick,
  validUsernames = []
}: RichContentRendererProps) {

  const processedHtml = useMemo(() => {
    if (!content) return ""

    let html = content

    if (onMentionClick) {
      html = html.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        (match, username) =>
          validUsernames.includes(username)
            ? `<span class="mention" data-username="${username}">@${username}</span>`
            : match
      )
    }

    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/\n/g, '<br>')

    return safeSanitize(html)
  }, [content, onMentionClick, validUsernames])

  const containerDir = getTextDirectionFromPlainText(
    (content || '').replace(/[*_~`]/g, '')
  )

  return (
    <div
      className={`rich-content-rendered ${className}`.trim()}
      dir={containerDir}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.classList.contains('mention') && onMentionClick) {
          const username = target.getAttribute('data-username')
          if (username) onMentionClick(username)
        }
      }}
    />
  )
}
