"use client"

import { PostStyle } from "./PostStyleSelector"

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
  // If no rich content AND no style, render plain content with mentions
  if (!richContent && !postStyle) {
    return (
      <p className={className}>
        {renderMentions(content, onMentionClick)}
      </p>
    )
  }

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

  // Process rich content if available, otherwise fall back to plain content
  const contentToRender = richContent || content

  return (
    <div 
      className={`rich-content ${className}`}
      style={containerStyle}
    >
      {renderRichContent(contentToRender, onMentionClick)}
    </div>
  )
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

// Helper function to render rich content with formatting
function renderRichContent(content: string, onMentionClick?: (username: string) => void) {
  // Enhanced rich content parser that handles both HTML and markdown formatting
  
  let processedContent = content

  // Check if content already contains HTML tags (from rich text editor)
  const hasHtmlTags = /<[^>]+>/.test(content)
  
  if (hasHtmlTags) {
    // Content already has HTML formatting, just handle mentions
    if (onMentionClick) {
      processedContent = processedContent.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        '<span class="mention" data-username="$1">@$1</span>'
      )
    }
  } else {
    // Handle mentions first
    if (onMentionClick) {
      processedContent = processedContent.replace(
        /@([a-zA-Z0-9_\-\.]+)/g,
        '<span class="mention" data-username="$1">@$1</span>'
      )
    }

    // Handle basic markdown-style formatting
    processedContent = processedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/__(.*?)__/g, '<u>$1</u>') // Underline
      .replace(/\n/g, '<br>') // Line breaks
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: processedContent }}
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
      className="rich-content-rendered"
      style={{
        // Ensure mentions are styled properly
        '--mention-color': '#7C3AED',
        '--mention-hover-color': '#5B21B6'
      } as React.CSSProperties}
    />
  )
}

// CSS for rich content (you might want to add this to your global styles)
const richContentStyles = `
.rich-content-rendered .mention {
  color: var(--mention-color);
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}

.rich-content-rendered .mention:hover {
  color: var(--mention-hover-color);
  text-decoration: underline;
}

.rich-content-rendered strong {
  font-weight: bold;
}

.rich-content-rendered em {
  font-style: italic;
}

.rich-content-rendered u {
  text-decoration: underline;
}
`

// Export styles for use in global CSS
export { richContentStyles }