/**
 * Utility to map emoji codes to actual emoji characters
 */

export const emojiCodeToEmoji: { [key: string]: string } = {
  // Hearts and love
  'heart': '❤️',
  'heart_face': '😍',
  'heart_eyes': '😍',
  'smiling_face_with_heart_eyes': '😍',
  
  // Happy emotions
  'smile': '😊',
  'grinning': '😀',
  'joy': '😂',
  'laughing': '😆',
  'smiley': '😃',
  'happy': '😊',
  
  // Support and encouragement
  'pray': '🙏',
  'clap': '👏',
  'muscle': '💪',
  'thumbs_up': '👍',
  'raised_hands': '🙌',
  
  // Fire and excitement
  'fire': '🔥',
  'star': '⭐',
  'sparkles': '✨',
  
  // Thinking and contemplation
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
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'clap', emoji: '👏', label: 'Applause' },
    { code: 'joy', emoji: '😂', label: 'Funny' },
    { code: 'thinking', emoji: '🤔', label: 'Thinking' },
    { code: 'star', emoji: '⭐', label: 'Amazing' }
  ]
}