/**
 * Utility functions for handling @username mentions in post content
 */

export interface MentionMatch {
  username: string
  startIndex: number
  endIndex: number
}

/**
 * Regular expression for matching @username mentions
 * Matches @username where username contains letters, numbers, underscores, dots, and dashes only
 * Restricted to match realistic username patterns and avoid false positives
 */
export const MENTION_REGEX = /@([a-zA-Z0-9_\-\.]+)/g

/**
 * Extract @username mentions from text content
 * @param content - Text content to parse
 * @returns Array of mention matches with positions
 */
export function extractMentions(content: string): MentionMatch[] {
  if (!content) return []
  
  const mentions: MentionMatch[] = []
  let match
  
  // Reset regex lastIndex to ensure consistent behavior
  MENTION_REGEX.lastIndex = 0
  
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    mentions.push({
      username: match[1], // Username without @
      startIndex: match.index,
      endIndex: match.index + match[0].length
    })
  }
  
  return mentions
}

/**
 * Check if text contains any @username mentions
 * @param content - Text content to check
 * @returns True if mentions are found
 */
export function hasMentions(content: string): boolean {
  if (!content) return false
  
  MENTION_REGEX.lastIndex = 0
  return MENTION_REGEX.test(content)
}

/**
 * Split content into parts with mentions identified
 * @param content - Text content to split
 * @returns Array of content parts with mention flags
 */
export interface ContentPart {
  text: string
  isMention: boolean
  username?: string // Only present if isMention is true
}

export function splitContentWithMentions(content: string, validUsernames?: string[]): ContentPart[] {
  if (!content) return [{ text: content, isMention: false }]
  
  const mentions = extractMentions(content)
  
  if (mentions.length === 0) {
    return [{ text: content, isMention: false }]
  }
  
  const parts: ContentPart[] = []
  let lastIndex = 0
  
  mentions.forEach((mention) => {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      const beforeText = content.slice(lastIndex, mention.startIndex)
      if (beforeText) {
        parts.push({ text: beforeText, isMention: false })
      }
    }
    
    // Add mention part - only mark as mention if username is in validUsernames array
    const mentionText = content.slice(mention.startIndex, mention.endIndex)
    const isValidMention = validUsernames ? validUsernames.includes(mention.username) : false
    
    parts.push({
      text: mentionText,
      isMention: isValidMention,
      username: isValidMention ? mention.username : undefined
    })
    
    lastIndex = mention.endIndex
  })
  
  // Add remaining text after last mention
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex)
    if (remainingText) {
      parts.push({ text: remainingText, isMention: false })
    }
  }
  
  return parts
}

/**
 * Validate username format (used for mention validation)
 * @param username - Username to validate
 * @returns True if username format is valid
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false
  
  // Username should be 1-50 characters, alphanumeric, underscores, dots, and dashes only
  // Restricted to match realistic username patterns and avoid false positives
  const usernameRegex = /^[a-zA-Z0-9_\-\.]{1,50}$/
  return usernameRegex.test(username)
}

/**
 * Get unique usernames from content
 * @param content - Text content to parse
 * @returns Array of unique usernames (without @)
 */
export function getUniqueUsernames(content: string): string[] {
  const mentions = extractMentions(content)
  const usernames = mentions.map(m => m.username)
  
  // Remove duplicates and return
  return Array.from(new Set(usernames))
}