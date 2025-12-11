/**
 * Utility to map emoji codes to actual emoji characters
 */

export const emojiCodeToEmoji: { [key: string]: string } = {
  // Hearts and love
  'heart': '💜',
  'heart_eyes': '😍',
  'hug': '🤗',
  
  // Support and encouragement
  'pray': '🙏',
  'clap': '👏',
  'muscle': '💪',
  'grateful': '🙏',
  'praise': '🙌',
  
  // Legacy mappings for backward compatibility
  'heart_face': '😍',
  'smiling_face_with_heart_eyes': '😍',
  'smile': '😊',
  'grinning': '😀',
  'joy': '😂',
  'laughing': '😆',
  'smiley': '😃',
  'happy': '😊',
  'thumbs_up': '👍',
  'raised_hands': '🙌',
  'fire': '🔥',
  'star': '⭐',
  'sparkles': '✨',
  'thinking': '🤔',
  'mind_blown': '🤯',
  
  // Default fallbacks
  'default': '👍'
}

/**
 * Convert emoji code to actual emoji character
 */
export function getEmojiFromCode(code: string): string {
  return emojiCodeToEmoji[code] || emojiCodeToEmoji['default'] || '👍'
}

/**
 * Get available emoji options for picker
 */
export function getAvailableEmojis(): { code: string; emoji: string; label: string }[] {
  return [
    { code: 'heart', emoji: '💜', label: 'Heart' },
    { code: 'heart_eyes', emoji: '😍', label: 'Love it' },
    { code: 'hug', emoji: '🤗', label: 'Hug' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'grateful', emoji: '🙏', label: 'Thankful' },
    { code: 'praise', emoji: '🙌', label: 'Praise' },
    { code: 'clap', emoji: '👏', label: 'Applause' }
  ]
}