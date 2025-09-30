"use client"

import { PostStyle } from "./PostStyleSelector"
import { useMemo } from 'react'
import "../styles/rich-content.css"
import { getTextDirection, getTextAlignmentClass, getDirectionAttribute, getTextDirectionFromPlainText } from "@/utils/rtlUtils"
import { getTextColorForBackground, extractPrimaryBackgroundColor } from "@/utils/colorUtils"

// Safe DOMPurify usage for client-side only
function safeSanitize(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic sanitization
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }
  
  // Client-side: use DOMPurify
  try {
    const DOMPurify = require('dompurify')
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'u', 'span', 'br', 'p', 'div'],
      ALLOWED_ATTR: ['style', 'class', 'data-username']
    })
  } catch (error) {
    console.warn('DOMPurify not available, using basic sanitization')
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }
}

interface RichContentRendererProps {
  content: string
  postStyle?: PostStyle
  post_style?: PostStyle  // Backend field name
  className?: string
  onMentionClick?: (username: string) => void
  validUsernames?: string[]
}



export default function RichContentRenderer({
  content,
  postStyle,
  post_style,
  className = "",
  onMentionClick,
  validUsernames = []
}: RichContentRendererProps) {
  // Apply post style (prefer backend field names)
  const activePostStyle = post_style || postStyle
  const containerStyle: React.CSSProperties = activePostStyle ? {
    background: activePostStyle.backgroundGradient || activePostStyle.backgroundColor,
    backgroundColor: activePostStyle.backgroundColor,
    color: (activePostStyle.textColor && activePostStyle.textColor !== 'auto')
      ? activePostStyle.textColor
      : (() => {
        const primary = extractPrimaryBackgroundColor(activePostStyle.backgroundGradient || activePostStyle.backgroundColor || 'transparent');
        return getTextColorForBackground(primary, '#374151');
      })(),
    border: activePostStyle.borderStyle || 'none',
    textShadow: activePostStyle.textShadow || 'none',
    fontFamily: activePostStyle.fontFamily || 'inherit',
    padding: '16px',
    borderRadius: '12px',
    margin: '8px 0'
  } : {}

  // Process HTML with simplified container-level direction handling
  const processedHtml = useMemo(() => {
    if (!content) return "";

    // 1) Convert markdown to HTML if needed
    let html = content;
    
    // Handle mentions first
    if (onMentionClick) {
      html = html.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        (match, username) => {
          const isValid = validUsernames.includes(username)
          if (isValid) {
            return `<span class="mention text-purple-600" data-username="${username}">@${username}</span>`
          } else {
            return `@${username}`
          }
        }
      )
    }

    // Convert markdown to HTML
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/__(.*?)__/g, '<u>$1</u>') // Underline
      .replace(/\n/g, '<br>'); // Line breaks

    // 2) Sanitize HTML - let browser handle direction naturally
    const sanitized = safeSanitize(html);

    // No DOM manipulation - let container-level direction handle everything
    return sanitized;
  }, [content, onMentionClick, validUsernames]);

  // Container direction from plain content (remove markdown formatting for detection)
  const containerDir = getTextDirectionFromPlainText((content || '').replace(/[*_~`]/g, ''));

  return (
    <div 
      className="rich-content" 
      style={containerStyle}
    >
      <div
        className={`rich-content-rendered ${className}`.trim()}
        dir={containerDir}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onClick={(e) => {
          // Handle mention clicks
          const target = e.target as HTMLElement
          if (target.classList.contains('mention') && onMentionClick) {
            const username = target.getAttribute('data-username')
            if (username) {
              onMentionClick(username)
            }
          }
        }}
        style={{
          '--mention-color': '#7C3AED',
          '--mention-hover-color': '#5B21B6'
        } as React.CSSProperties}
      />
    </div>
  )
}

// Helper function to render mentions in plain text
function renderMentions(text: string, onMentionClick?: (username: string) => void, validUsernames: string[] = []) {
  if (!text) {
    return ""
  }

  if (!onMentionClick) {
    return text
  }

  const mentionRegex = /@([a-zA-Z0-9_\-\.]+)/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add mention as clickable element or plain text
    const username = match[1]
    const isValid = validUsernames.includes(username)
    
    if (isValid) {
      parts.push(
        <span
          key={`mention-${match.index}`}
          onClick={() => onMentionClick(username)}
          className="mention text-purple-600 hover:text-purple-800 hover:underline font-medium"
          data-username={username}
        >
          @{username}
        </span>
      )
    } else {
      // Invalid usernames are just plain text
      parts.push(`@${username}`)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  // Always return an array for React to render, or the original text if no mentions
  return parts.length > 0 ? parts : text
}