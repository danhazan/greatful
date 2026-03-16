/**
 * Utility to map emoji codes to actual emoji characters
 * This is the single source of truth for all emoji mappings in the frontend
 */

export const emojiCodeToEmoji: { [key: string]: string } = {
  //Row 1 - Original emojis
  'heart': '💜',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'heart_eyes': '😍',
  'hug': '🤗',
  'touched': '🥹',      // Position 4 - "Grateful" (was incorrectly 'pray')
  'muscle': '💪',
  'grateful': '🙏',     // Position 6 - "Thankful"
  'praise': '🙌',
  'clap': '👏',

  // Row 2 - Love/Warmth
  'star': '⭐',
  'fire': '🔥',
  'sparkles': '✨',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'heart_face': '🥰',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'sparkling_heart': '💖',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'gift_heart': '💝',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'two_hearts': '💕',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'growing_heart': '💗',

  // Row 3 - Joy/Celebration
  'party': '🎉',
  'confetti': '🎊',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'partying_face': '🥳',
  'blush': '😊',
  'grinning': '😄',
  'beaming': '😁',
  'starstruck': '🤩',
  'smile': '🙂',

  // Row 4 - Encouragement
  'hundred': '💯',
  'trophy': '🏆',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'glowing_star': '🌟',
  'crown': '👑',
  'gem': '💎',
  'bullseye': '🎯',
  'check': '✅',
  'dizzy': '💫',

  // Row 5 - Nature/Peace
  'rainbow': '🌈',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'sunflower': '🌻',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'cherry_blossom': '🌸',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'four_leaf_clover': '🍀',
  'hibiscus': '🌺',
  'tulip': '🌷',
  'blossom': '🌼',
  'butterfly': '🦋',

  // Row 6 - Affection
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'heart_hands': '🫶',
  'handshake': '🤝',
  'open_hands': '👐',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'hugging_people': '🫂',
  'bouquet': '💐',
  'gift': '🎁',
  'dove': '🕊️',
  'sun': '☀️',

  // Row 7 - Expressions
  'innocent': '😇',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'holding_back_tears': '🥲',
  'relieved': '😌',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'face_with_hand': '🤭',
  'cool': '😎',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'warm_hug': '🤗',
  'yum': '😋',
  'salute': '🫡',

  // Legacy mappings for backward compatibility
  'pray': '🙏',         // Keep for backward compat with existing reactions
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'smiling_face_with_heart_eyes': '😍',
  'joy': '😂',
  'laughing': '😆',
  'smiley': '😃',
  'happy': '😊',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'thumbs_up': '👍',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'raised_hands': '🙌',
  'thinking': '🤔',
  // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
  'mind_blown': '🤯',

  // Default fallback
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
 * Returns all emojis organized in rows for the scrollable picker
 */
export function getAvailableEmojis(): { code: string; emoji: string; label: string }[] {
  return [
    // Row 1 - Original emojis (with bug fix: position 4 now shows 🥹)
    { code: 'heart', emoji: '💜', label: 'Heart' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'heart_eyes', emoji: '😍', label: 'Love it' },
    { code: 'hug', emoji: '🤗', label: 'Hug' },
    { code: 'touched', emoji: '🥹', label: 'Grateful' },  // Fixed: was 'pray' with 🙏
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'grateful', emoji: '🙏', label: 'Thankful' },
    { code: 'praise', emoji: '🙌', label: 'Praise' },
    { code: 'clap', emoji: '👏', label: 'Applause' },

    // Row 2 - Love/Warmth
    { code: 'star', emoji: '⭐', label: 'Star' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'sparkles', emoji: '✨', label: 'Sparkles' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'heart_face', emoji: '🥰', label: 'Adore' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'sparkling_heart', emoji: '💖', label: 'Sparkling' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'gift_heart', emoji: '💝', label: 'Gift Heart' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'two_hearts', emoji: '💕', label: 'Two Hearts' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'growing_heart', emoji: '💗', label: 'Growing Heart' },

    // Row 3 - Joy/Celebration
    { code: 'party', emoji: '🎉', label: 'Party' },
    { code: 'confetti', emoji: '🎊', label: 'Confetti' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'partying_face', emoji: '🥳', label: 'Celebrate' },
    { code: 'blush', emoji: '😊', label: 'Blush' },
    { code: 'grinning', emoji: '😄', label: 'Grinning' },
    { code: 'beaming', emoji: '😁', label: 'Beaming' },
    { code: 'starstruck', emoji: '🤩', label: 'Starstruck' },
    { code: 'smile', emoji: '🙂', label: 'Smile' },

    // Row 4 - Encouragement
    { code: 'hundred', emoji: '💯', label: 'Perfect' },
    { code: 'trophy', emoji: '🏆', label: 'Trophy' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'glowing_star', emoji: '🌟', label: 'Glowing Star' },
    { code: 'crown', emoji: '👑', label: 'Crown' },
    { code: 'gem', emoji: '💎', label: 'Gem' },
    { code: 'bullseye', emoji: '🎯', label: 'Bullseye' },
    { code: 'check', emoji: '✅', label: 'Check' },
    { code: 'dizzy', emoji: '💫', label: 'Dizzy' },

    // Row 5 - Nature/Peace
    { code: 'rainbow', emoji: '🌈', label: 'Rainbow' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'sunflower', emoji: '🌻', label: 'Sunflower' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'cherry_blossom', emoji: '🌸', label: 'Cherry Blossom' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'four_leaf_clover', emoji: '🍀', label: 'Lucky' },
    { code: 'hibiscus', emoji: '🌺', label: 'Hibiscus' },
    { code: 'tulip', emoji: '🌷', label: 'Tulip' },
    { code: 'blossom', emoji: '🌼', label: 'Blossom' },
    { code: 'butterfly', emoji: '🦋', label: 'Butterfly' },

    // Row 6 - Affection
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'heart_hands', emoji: '🫶', label: 'Heart Hands' },
    { code: 'handshake', emoji: '🤝', label: 'Handshake' },
    { code: 'open_hands', emoji: '👐', label: 'Open Hands' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'hugging_people', emoji: '🫂', label: 'Hugging' },
    { code: 'bouquet', emoji: '💐', label: 'Bouquet' },
    { code: 'gift', emoji: '🎁', label: 'Gift' },
    { code: 'dove', emoji: '🕊️', label: 'Peace' },
    { code: 'sun', emoji: '☀️', label: 'Sunshine' },

    // Row 7 - Expressions
    { code: 'innocent', emoji: '😇', label: 'Innocent' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'holding_back_tears', emoji: '🥲', label: 'Touched' },
    { code: 'relieved', emoji: '😌', label: 'Relieved' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'face_with_hand', emoji: '🤭', label: 'Giggle' },
    { code: 'cool', emoji: '😎', label: 'Cool' },
    // eslint-disable-next-line no-restricted-syntax -- emoji codes intentionally snake_case identifiers
    { code: 'warm_hug', emoji: '🤗', label: 'Warm Hug' },
    { code: 'yum', emoji: '😋', label: 'Yum' },
    { code: 'salute', emoji: '🫡', label: 'Salute' },
  ]
}