"use client"

import { PostStyle } from "./PostStyleSelector"
import DOMPurify from 'dompurify'
import "../styles/rich-content.css"

interface RichContentRendererProps {
  content: string
  richContent?: string
  postStyle?: PostStyle
  className?: string
  onMentionClick?: (username: string) => void
}

export default function RichContentRenderer({
  content,
  richContent,
  postStyle,
  className = "",
  onMentionClick
}: RichContentRendererProps) {
  // Apply post style
  const containerStyle: React.CSSProperties = postStyle ? {
    backgroundColor: postStyle.backgroundColor,
    background: postStyle.backgroundGradient || postStyle.backgroundColor,
    color: postStyle.textColor,
    border: postStyle.borderStyle || 'none',
    textShadow: postStyle.textShadow || 'none',
    fontFamily: postStyle.fontFamily || 'inherit',
    padding: '16px',
    borderRadius: '12px',
    margin: '8px 0'
  } : {}

  // Determine what content to render
  const hasRichContent = richContent && richContent.trim() !== '' && richContent !== content
  const contentToRender = hasRichContent ? richContent : content

  // Check if content contains HTML tags
  const hasHtmlTags = /<[^>]+>/.test(contentToRender)

  // DEBUG: Log what we're rendering
  console.log("🎨 RichContentRenderer Debug:", {
    content,
    richContent,
    hasRichContent,
    contentToRender,
    hasHtmlTags
  })

  // Process content into HTML (either existing HTML or convert markdown to HTML)
  let processedContent = contentToRender

  if (hasHtmlTags) {
    // Content already has HTML, just handle mentions
    if (onMentionClick) {
      processedContent = processedContent.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        '<span class="mention" data-username="$1">@$1</span>'
      )
    }
  } else {
    // Convert markdown-style formatting to HTML
    // Handle mentions first
    if (onMentionClick) {
      processedContent = processedContent.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        '<span class="mention" data-username="$1">@$1</span>'
      )
    }

    // Convert markdown to HTML
    processedContent = processedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/__(.*?)__/g, '<u>$1</u>') // Underline
      .replace(/\n/g, '<br>') // Line breaks
  }

  // Check if we have any HTML to render (either original HTML or converted markdown)
  const hasProcessedHtml = /<[^>]+>/.test(processedContent)

  if (hasProcessedHtml) {
    // Sanitize HTML for security
    const sanitizedHTML = DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: ['strong', 'em', 'u', 'span', 'br', 'p'],
      ALLOWED_ATTR: ['style', 'class', 'data-username']
    })

    return (
      <div 
        className="rich-content"
        style={containerStyle}
      >
        <div
          className={`rich-content-rendered ${className}`.trim()}
          dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
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
  } else {
    // Plain text content, render with mention support
    return (
      <div 
        className="rich-content"
        style={containerStyle}
      >
        <div className={`rich-content-rendered ${className}`.trim()}>
          {renderMentions(contentToRender, onMentionClick)}
        </div>
      </div>
    )
  }
}

// Helper function to render mentions in plain text
function renderMentions(text: string, onMentionClick?: (username: string) => void) {
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

    // Add mention as clickable element
    const username = match[1]
    parts.push(
      <button
        key={`mention-${match.index}`}
        onClick={() => onMentionClick(username)}
        className="text-purple-600 hover:text-purple-800 hover:underline font-medium"
      >
        @{username}
      </button>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  // Always return an array for React to render, or the original text if no mentions
  return parts.length > 0 ? parts : text
}