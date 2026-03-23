"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Smile, Heart, Hand, Flower, PartyPopper, Cake, Dog, Car, Watch, History } from "lucide-react"
import { getCompleteInputStyling } from '@/utils/inputStyles'

interface MinimalEmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  position?: { x: number, y: number }
  anchorGap?: number
  variant?: 'floating' | 'inline'
  viewportInset?: number
  className?: string
}

// Enhanced emoji groups with extensive positive emojis for gratitude posts
const EMOJI_GROUPS = [
  {
    name: 'Smileys & Happiness',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷',
      '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
      '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱'
    ]
  },
  {
    name: 'Hearts & Love',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '♥️', '💌', '💋', '💍', '💎', '🔥', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬',
      '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋🏻', '🤚🏻', '🖐🏻', '✋🏻', '🖖🏻', '👌🏻', '🤏🏻', '✌🏻', '🤞🏻',
      '🤟🏻', '🤘🏻', '🤙🏻', '👈🏻', '👉🏻', '👆🏻', '🖕🏻', '👇🏻', '☝🏻', '👍🏻', '👎🏻', '👊🏻', '✊🏻', '🤛🏻'
    ]
  },
  {
    name: 'Hand Gestures',
    icon: Hand,
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿',
      '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒',
      '👦', '👧', '🧑', '👱', '👨', '🧔', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '👩‍🦱', '👩‍🦳', '👩‍🦲', '🧓'
    ]
  },
  {
    name: 'Nature & Weather',
    icon: Flower,
    emojis: [
      '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌿', '🍀', '🌱', '🌳', '🌲', '🌴', '🌵', '🌾', '🌈', '☀️',
      '🌙', '⭐', '🌟', '💫', '✨', '🔥', '💧', '🌊', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕',
      '🌖', '🌗', '🌘', '🌚', '🌝', '🌛', '🌜', '🌞', '⚡', '☄️', '💥', '🌪️', '☁️', '⛅', '⛈️', '🌤️',
      '🌦️', '🌧️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨'
    ]
  },
  {
    name: 'Celebration & Success',
    icon: PartyPopper,
    emojis: [
      '🎉', '🎊', '🥳', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁', '🥂', '🍾', '🎆', '🎇', '🎪', '🎭', '🎨',
      '🎵', '🎶', '🎼', '🏆', '🥇', '🎯', '🎲', '🎮', '🎳', '🎱', '🏀', '⚽', '🏈', '⚾', '🥎', '🎾',
      '🏐', '🏉', '🥏', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹',
      '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️‍♂️', '🤸‍♀️'
    ]
  },
  {
    name: 'Food & Treats',
    icon: Cake,
    emojis: [
      '🍰', '🧁', '🍪', '🍫', '🍯', '🍓', '🍒', '🍑', '🥭', '🍊', '🍋', '🥝', '🍇', '🍉', '🫐', '🍎',
      '🍏', '🍐', '🍌', '🥥', '🥑', '🍅', '🍆', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥕', '🌽', '🌶️',
      '🫑', '🥖', '🥐', '🍞', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭',
      '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛'
    ]
  },
  {
    name: 'Animals & Pets',
    icon: Dog,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸',
      '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
      '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️',
      '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬'
    ]
  },
  {
    name: 'Travel & Places',
    icon: Car,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
      '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🪂', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓',
      '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️',
      '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭'
    ]
  },
  {
    name: 'Objects & Symbols',
    icon: Watch,
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼',
      '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
      '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸',
      '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️'
    ]
  }
]

// Comprehensive emoji database with names and search tags
const EMOJI_DATA: Record<string, { name: string, keywords: string[] }> = {
  // Smileys & Happiness
  '😀': { name: 'grinning face', keywords: ['grinning', 'face', 'smile', 'happy', 'joy', 'laugh'] },
  '😃': { name: 'grinning face with big eyes', keywords: ['grinning', 'face', 'happy', 'joy', 'haha', 'laugh', 'smile'] },
  '😄': { name: 'grinning face with smiling eyes', keywords: ['face', 'happy', 'joy', 'laugh', 'pleased', 'smile'] },
  '😁': { name: 'beaming face with smiling eyes', keywords: ['eye', 'face', 'grin', 'happy', 'smile'] },
  '😆': { name: 'grinning squinting face', keywords: ['face', 'happy', 'joy', 'laugh', 'satisfied', 'smile'] },
  '😅': { name: 'grinning face with sweat', keywords: ['cold', 'face', 'open', 'smile', 'sweat'] },
  '🤣': { name: 'rolling on the floor laughing', keywords: ['face', 'floor', 'laugh', 'rolling', 'rofl', 'lol'] },
  '😂': { name: 'face with tears of joy', keywords: ['face', 'joy', 'laugh', 'tear', 'cry', 'happy'] },
  '🙂': { name: 'slightly smiling face', keywords: ['face', 'smile', 'happy'] },
  '🙃': { name: 'upside-down face', keywords: ['face', 'upside-down', 'silly'] },
  '😉': { name: 'winking face', keywords: ['face', 'wink', 'flirt'] },
  '😊': { name: 'smiling face with smiling eyes', keywords: ['blush', 'eye', 'face', 'happy', 'smile'] },
  '😇': { name: 'smiling face with halo', keywords: ['angel', 'face', 'fantasy', 'halo', 'innocent', 'smile'] },
  '🥰': { name: 'smiling face with hearts', keywords: ['adore', 'crush', 'hearts', 'in love', 'love'] },
  '😍': { name: 'smiling face with heart-eyes', keywords: ['eye', 'face', 'love', 'smile', 'heart'] },
  '🤩': { name: 'star-struck', keywords: ['eyes', 'face', 'grinning', 'star', 'starry-eyed'] },
  '😘': { name: 'face blowing a kiss', keywords: ['face', 'kiss', 'love', 'heart'] },
  '😗': { name: 'kissing face', keywords: ['face', 'kiss', 'love'] },
  '☺️': { name: 'smiling face', keywords: ['face', 'outlined', 'relaxed', 'smile'] },
  '😚': { name: 'kissing face with closed eyes', keywords: ['closed', 'eye', 'face', 'kiss', 'love'] },
  '😙': { name: 'kissing face with smiling eyes', keywords: ['eye', 'face', 'kiss', 'smile'] },
  '🥲': { name: 'smiling face with tear', keywords: ['grateful', 'proud', 'relieved', 'smiling', 'tear', 'touched'] },
  '😋': { name: 'face savoring food', keywords: ['delicious', 'face', 'savouring', 'smile', 'yum'] },
  '😛': { name: 'face with tongue', keywords: ['face', 'tongue', 'playful'] },
  '😜': { name: 'winking face with tongue', keywords: ['eye', 'face', 'joke', 'tongue', 'wink'] },
  '🤪': { name: 'zany face', keywords: ['eye', 'goofy', 'large', 'small', 'crazy'] },
  '😝': { name: 'squinting face with tongue', keywords: ['eye', 'face', 'horrible', 'taste', 'tongue'] },
  '🤑': { name: 'money-mouth face', keywords: ['face', 'money', 'mouth', 'dollar'] },
  '🤗': { name: 'hugging face', keywords: ['face', 'hug', 'hugging', 'warm'] },
  '🤭': { name: 'face with hand over mouth', keywords: ['whoops', 'shock', 'surprise'] },
  '🤫': { name: 'shushing face', keywords: ['quiet', 'shush', 'secret'] },
  '🤔': { name: 'thinking face', keywords: ['face', 'thinking', 'hmm'] },

  // Hearts & Love
  '❤️': { name: 'red heart', keywords: ['heart', 'love', 'red'] },
  '🧡': { name: 'orange heart', keywords: ['heart', 'love', 'orange'] },
  '💛': { name: 'yellow heart', keywords: ['heart', 'love', 'yellow'] },
  '💚': { name: 'green heart', keywords: ['heart', 'love', 'green'] },
  '💙': { name: 'blue heart', keywords: ['heart', 'love', 'blue'] },
  '💜': { name: 'purple heart', keywords: ['heart', 'love', 'purple'] },
  '🖤': { name: 'black heart', keywords: ['heart', 'love', 'black'] },
  '🤍': { name: 'white heart', keywords: ['heart', 'love', 'white'] },
  '🤎': { name: 'brown heart', keywords: ['heart', 'love', 'brown'] },
  '💔': { name: 'broken heart', keywords: ['break', 'broken', 'heart', 'sad'] },
  '❣️': { name: 'heart exclamation', keywords: ['exclamation', 'heart', 'love'] },
  '💕': { name: 'two hearts', keywords: ['heart', 'love', 'two'] },
  '💞': { name: 'revolving hearts', keywords: ['heart', 'love', 'revolving'] },
  '💓': { name: 'beating heart', keywords: ['beating', 'heart', 'love', 'pulsating'] },
  '💗': { name: 'growing heart', keywords: ['excited', 'growing', 'heart', 'love', 'nervous'] },
  '💖': { name: 'sparkling heart', keywords: ['excited', 'heart', 'love', 'sparkle'] },
  '💘': { name: 'heart with arrow', keywords: ['arrow', 'cupid', 'heart', 'love'] },
  '💝': { name: 'heart with ribbon', keywords: ['heart', 'love', 'ribbon', 'valentine'] },
  '💟': { name: 'heart decoration', keywords: ['heart', 'love', 'purple-square'] },
  '♥️': { name: 'heart suit', keywords: ['card', 'game', 'heart', 'suit'] },
  '💌': { name: 'love letter', keywords: ['heart', 'letter', 'love', 'mail'] },
  '💋': { name: 'kiss mark', keywords: ['kiss', 'lips', 'love', 'romance'] },
  '💍': { name: 'ring', keywords: ['diamond', 'engagement', 'ring', 'wedding'] },
  '💎': { name: 'gem stone', keywords: ['diamond', 'gem', 'jewel', 'precious'] },

  // Hand Gestures
  '👍': { name: 'thumbs up', keywords: ['thumbs', 'up', 'good', 'yes', 'approve'] },
  '👎': { name: 'thumbs down', keywords: ['thumbs', 'down', 'bad', 'no', 'disapprove'] },
  '👌': { name: 'OK hand', keywords: ['hand', 'ok', 'okay', 'perfect', 'good'] },
  '🤌': { name: 'pinched fingers', keywords: ['fingers', 'hand', 'pinched'] },
  '🤏': { name: 'pinching hand', keywords: ['small', 'tiny', 'pinch'] },
  '✌️': { name: 'victory hand', keywords: ['hand', 'peace', 'victory', 'two'] },
  '🤞': { name: 'crossed fingers', keywords: ['cross', 'finger', 'hand', 'luck'] },
  '🤟': { name: 'love-you gesture', keywords: ['hand', 'love-you'] },
  '🤘': { name: 'sign of the horns', keywords: ['finger', 'hand', 'horns', 'rock'] },
  '🤙': { name: 'call me hand', keywords: ['call', 'hand', 'hang loose'] },
  '👈': { name: 'backhand index pointing left', keywords: ['finger', 'hand', 'index', 'point'] },
  '👉': { name: 'backhand index pointing right', keywords: ['finger', 'hand', 'index', 'point'] },
  '👆': { name: 'backhand index pointing up', keywords: ['finger', 'hand', 'index', 'point', 'up'] },
  '🖕': { name: 'middle finger', keywords: ['finger', 'hand', 'middle finger'] },
  '👇': { name: 'backhand index pointing down', keywords: ['finger', 'hand', 'index', 'point', 'down'] },
  '☝️': { name: 'index pointing up', keywords: ['finger', 'hand', 'index', 'point', 'up'] },
  '👋': { name: 'waving hand', keywords: ['hand', 'wave', 'waving'] },
  '🤚': { name: 'raised back of hand', keywords: ['backhand', 'raised'] },
  '🖐️': { name: 'hand with fingers splayed', keywords: ['finger', 'hand', 'splayed'] },
  '✋': { name: 'raised hand', keywords: ['hand', 'high 5', 'stop'] },
  '🖖': { name: 'vulcan salute', keywords: ['finger', 'hand', 'spock', 'vulcan'] },
  '👏': { name: 'clapping hands', keywords: ['clap', 'hands', 'applause', 'praise'] },
  '🙌': { name: 'raising hands', keywords: ['celebration', 'gesture', 'hand', 'hooray', 'raised'] },
  '🤲': { name: 'palms up together', keywords: ['prayer', 'cupped hands'] },
  '🤝': { name: 'handshake', keywords: ['agreement', 'hand', 'meeting', 'shake'] },
  '🙏': { name: 'folded hands', keywords: ['ask', 'hand', 'high 5', 'please', 'pray', 'thanks'] },
  '✍️': { name: 'writing hand', keywords: ['hand', 'write'] },
  '💅': { name: 'nail polish', keywords: ['care', 'cosmetics', 'manicure', 'nail', 'polish'] },
  '🤳': { name: 'selfie', keywords: ['camera', 'phone'] },
  '💪': { name: 'flexed biceps', keywords: ['biceps', 'comic', 'flex', 'muscle', 'strength'] },

  // Food & Treats
  '🍰': { name: 'shortcake', keywords: ['cake', 'dessert', 'pastry', 'slice', 'sweet'] },
  '🧁': { name: 'cupcake', keywords: ['bakery', 'cupcake', 'dessert', 'fairy cake', 'sweet'] },
  '🍪': { name: 'cookie', keywords: ['cookie', 'dessert', 'sweet'] },
  '🍫': { name: 'chocolate bar', keywords: ['bar', 'chocolate', 'dessert', 'sweet'] },
  '🍯': { name: 'honey pot', keywords: ['honey', 'honeypot', 'pot', 'sweet'] },
  '🍓': { name: 'strawberry', keywords: ['berry', 'fruit', 'strawberry'] },
  '🍒': { name: 'cherries', keywords: ['berries', 'cherry', 'fruit', 'red'] },
  '🍑': { name: 'peach', keywords: ['fruit', 'peach'] },
  '🥭': { name: 'mango', keywords: ['fruit', 'mango', 'tropical'] },
  '🍊': { name: 'tangerine', keywords: ['fruit', 'orange', 'tangerine'] },
  '🍋': { name: 'lemon', keywords: ['citrus', 'fruit', 'lemon'] },
  '🥝': { name: 'kiwi fruit', keywords: ['food', 'fruit', 'kiwi'] },
  '🍇': { name: 'grapes', keywords: ['fruit', 'grape'] },
  '🍉': { name: 'watermelon', keywords: ['fruit', 'watermelon'] },
  '🫐': { name: 'blueberries', keywords: ['berry', 'blue', 'blueberry', 'fruit'] },
  '🍎': { name: 'red apple', keywords: ['apple', 'fruit', 'red'] },
  '🍏': { name: 'green apple', keywords: ['apple', 'fruit', 'green'] },
  '🍐': { name: 'pear', keywords: ['fruit', 'pear'] },
  '🍌': { name: 'banana', keywords: ['fruit', 'banana'] },
  '🥥': { name: 'coconut', keywords: ['coconut', 'fruit'] },
  '🥑': { name: 'avocado', keywords: ['avocado', 'fruit'] },
  '🍅': { name: 'tomato', keywords: ['fruit', 'tomato', 'vegetable'] },
  '🍆': { name: 'eggplant', keywords: ['aubergine', 'eggplant', 'vegetable'] },
  '🥒': { name: 'cucumber', keywords: ['cucumber', 'pickle', 'vegetable'] },
  '🥬': { name: 'leafy greens', keywords: ['bok choy', 'cabbage', 'kale', 'lettuce'] },
  '🥦': { name: 'broccoli', keywords: ['broccoli', 'vegetable'] },
  '🧄': { name: 'garlic', keywords: ['garlic'] },
  '🧅': { name: 'onion', keywords: ['onion'] },
  '🍄': { name: 'mushroom', keywords: ['mushroom', 'toadstool'] },
  '🥕': { name: 'carrot', keywords: ['carrot', 'vegetable'] },
  '🌽': { name: 'ear of corn', keywords: ['corn', 'ear', 'maize'] },
  '🌶️': { name: 'hot pepper', keywords: ['hot', 'pepper', 'spicy'] },
  '🫑': { name: 'bell pepper', keywords: ['bell pepper', 'capsicum', 'pepper'] },
  '🥖': { name: 'baguette bread', keywords: ['baguette', 'bread', 'french'] },
  '🥐': { name: 'croissant', keywords: ['bread', 'croissant', 'french'] },
  '🍞': { name: 'bread', keywords: ['bread', 'loaf'] },
  '🥯': { name: 'bagel', keywords: ['bagel', 'bakery', 'breakfast'] },
  '🧀': { name: 'cheese wedge', keywords: ['cheese'] },
  '🥚': { name: 'egg', keywords: ['egg'] },
  '🍳': { name: 'cooking', keywords: ['cooking', 'egg', 'frying', 'pan'] },
  '🧈': { name: 'butter', keywords: ['butter', 'dairy'] },
  '🥞': { name: 'pancakes', keywords: ['crêpe', 'hotcake', 'pancake'] },
  '🧇': { name: 'waffle', keywords: ['waffle'] },
  '🥓': { name: 'bacon', keywords: ['bacon', 'meat'] },
  '🥩': { name: 'cut of meat', keywords: ['chop', 'lambchop', 'porkchop', 'steak'] },
  '🍗': { name: 'poultry leg', keywords: ['bone', 'chicken', 'drumstick', 'leg'] },
  '🍖': { name: 'meat on bone', keywords: ['bone', 'meat'] },
  '🌭': { name: 'hot dog', keywords: ['frankfurter', 'hotdog', 'sausage'] },
  '🍔': { name: 'hamburger', keywords: ['burger', 'hamburger'] },
  '🍟': { name: 'french fries', keywords: ['french', 'fries'] },
  '🍕': { name: 'pizza', keywords: ['cheese', 'pizza', 'slice'] },
  '🥪': { name: 'sandwich', keywords: ['bread', 'sandwich'] },
  '🥙': { name: 'stuffed flatbread', keywords: ['falafel', 'flatbread', 'gyro', 'kebab'] },
  '🧆': { name: 'falafel', keywords: ['falafel', 'meatball'] },
  '🌮': { name: 'taco', keywords: ['mexican', 'taco'] },
  '🌯': { name: 'burrito', keywords: ['burrito', 'mexican', 'wrap'] },
  '🫔': { name: 'tamale', keywords: ['mexican', 'tamale'] },
  '🥗': { name: 'green salad', keywords: ['green', 'salad'] },
  '🥘': { name: 'shallow pan of food', keywords: ['casserole', 'curry', 'paella', 'pan', 'shallow'] },
  '🫕': { name: 'fondue', keywords: ['cheese', 'chocolate', 'fondue', 'pot'] },
  '🍝': { name: 'spaghetti', keywords: ['pasta', 'spaghetti'] },
  '🍜': { name: 'steaming bowl', keywords: ['bowl', 'noodle', 'ramen', 'steaming'] },
  '🍲': { name: 'pot of food', keywords: ['pot', 'stew'] },
  '🍛': { name: 'curry rice', keywords: ['curry', 'rice'] },

  // Nature & Weather
  '🌸': { name: 'cherry blossom', keywords: ['blossom', 'cherry', 'flower', 'spring'] },
  '🌺': { name: 'hibiscus', keywords: ['flower', 'hibiscus'] },
  '🌻': { name: 'sunflower', keywords: ['flower', 'sun', 'sunflower'] },
  '🌷': { name: 'tulip', keywords: ['flower', 'tulip'] },
  '🌹': { name: 'rose', keywords: ['flower', 'rose'] },
  '🌼': { name: 'daisy', keywords: ['daisy', 'flower'] },
  '🌿': { name: 'herb', keywords: ['herb', 'leaf'] },
  '🍀': { name: 'four leaf clover', keywords: ['4', 'clover', 'four', 'leaf', 'lucky'] },
  '🌱': { name: 'seedling', keywords: ['seedling', 'young'] },
  '🌳': { name: 'deciduous tree', keywords: ['deciduous', 'shedding', 'tree'] },
  '🌲': { name: 'evergreen tree', keywords: ['evergreen', 'needle', 'tree'] },
  '🌴': { name: 'palm tree', keywords: ['palm', 'tree'] },
  '🌵': { name: 'cactus', keywords: ['cactus', 'desert', 'plant'] },
  '🌾': { name: 'sheaf of rice', keywords: ['ear', 'grain', 'rice'] },
  '🌈': { name: 'rainbow', keywords: ['rain', 'rainbow'] },
  '☀️': { name: 'sun', keywords: ['bright', 'rays', 'sun', 'sunny'] },
  '🌙': { name: 'crescent moon', keywords: ['crescent', 'moon'] },
  '⭐': { name: 'star', keywords: ['star'] },
  '🌟': { name: 'glowing star', keywords: ['glittery', 'glow', 'shining', 'sparkle', 'star'] },
  '💫': { name: 'dizzy', keywords: ['comic', 'dizzy', 'star'] },
  '✨': { name: 'sparkles', keywords: ['sparkle', 'star'] },
  '🔥': { name: 'fire', keywords: ['fire', 'flame', 'hot'] },
  '💧': { name: 'droplet', keywords: ['comic', 'drop', 'sweat', 'water'] },
  '🌊': { name: 'water wave', keywords: ['ocean', 'water', 'wave'] },

  // Celebration & Success
  '🎉': { name: 'party popper', keywords: ['celebration', 'party', 'popper', 'tada'] },
  '🎊': { name: 'confetti ball', keywords: ['ball', 'celebration', 'confetti'] },
  '🥳': { name: 'partying face', keywords: ['celebration', 'hat', 'horn', 'party'] },
  '🎈': { name: 'balloon', keywords: ['balloon', 'celebration'] },
  '🎁': { name: 'wrapped gift', keywords: ['box', 'gift', 'present', 'wrapped'] },
  '🎀': { name: 'ribbon', keywords: ['celebration', 'ribbon'] },
  '🎂': { name: 'birthday cake', keywords: ['birthday', 'cake', 'celebration'] },
  '🥂': { name: 'clinking glasses', keywords: ['celebrate', 'clink', 'drink', 'glass'] },
  '🍾': { name: 'bottle with popping cork', keywords: ['bar', 'bottle', 'cork', 'drink', 'popping'] },
  '🎆': { name: 'fireworks', keywords: ['celebration', 'fireworks'] },
  '🎇': { name: 'sparkler', keywords: ['celebration', 'fireworks', 'sparkle'] },
  '🎪': { name: 'circus tent', keywords: ['circus', 'tent'] },
  '🎭': { name: 'performing arts', keywords: ['art', 'mask', 'performing', 'theatre'] },
  '🎨': { name: 'artist palette', keywords: ['art', 'museum', 'painting', 'palette'] },
  '🎵': { name: 'musical note', keywords: ['music', 'note'] },
  '🎶': { name: 'musical notes', keywords: ['music', 'note', 'notes'] },
  '🎼': { name: 'musical score', keywords: ['music', 'score'] },
  '🏆': { name: 'trophy', keywords: ['prize', 'trophy', 'winner'] },
  '🥇': { name: '1st place medal', keywords: ['first', 'gold', 'medal'] },
  '🎯': { name: 'direct hit', keywords: ['bull', 'bullseye', 'dart', 'direct', 'eye', 'hit', 'target'] },

  // Animals & Pets
  '🐶': { name: 'dog face', keywords: ['dog', 'face', 'pet'] },
  '🐱': { name: 'cat face', keywords: ['cat', 'face', 'pet'] },
  '🐭': { name: 'mouse face', keywords: ['face', 'mouse'] },
  '🐹': { name: 'hamster', keywords: ['face', 'hamster', 'pet'] },
  '🐰': { name: 'rabbit face', keywords: ['bunny', 'face', 'pet', 'rabbit'] },
  '🦊': { name: 'fox', keywords: ['face', 'fox'] },
  '🐻': { name: 'bear', keywords: ['bear', 'face'] },
  '🐼': { name: 'panda', keywords: ['face', 'panda'] },
  '🐻‍❄️': { name: 'polar bear', keywords: ['arctic', 'bear', 'polar', 'white'] },
  '🐨': { name: 'koala', keywords: ['bear', 'face', 'koala'] },
  '🐯': { name: 'tiger face', keywords: ['face', 'tiger'] },
  '🦁': { name: 'lion', keywords: ['face', 'leo', 'lion', 'zodiac'] },
  '🐮': { name: 'cow face', keywords: ['cow', 'face'] },
  '🐷': { name: 'pig face', keywords: ['face', 'pig'] },
  '🐽': { name: 'pig nose', keywords: ['face', 'nose', 'pig'] },
  '🐸': { name: 'frog', keywords: ['face', 'frog'] },

  // Travel & Places
  '🚗': { name: 'automobile', keywords: ['car', 'automobile'] },
  '🚕': { name: 'taxi', keywords: ['car', 'taxi', 'vehicle'] },
  '🚙': { name: 'sport utility vehicle', keywords: ['car', 'recreational', 'sport utility', 'suv'] },
  '🚌': { name: 'bus', keywords: ['bus', 'vehicle'] },
  '🚎': { name: 'trolleybus', keywords: ['bus', 'tram', 'trolley', 'trolleybus'] },
  '🏎️': { name: 'racing car', keywords: ['car', 'racing'] },
  '🚓': { name: 'police car', keywords: ['car', 'patrol', 'police'] },
  '🚑': { name: 'ambulance', keywords: ['ambulance', 'vehicle'] },
  '🚒': { name: 'fire engine', keywords: ['engine', 'fire', 'truck'] },
  '🚐': { name: 'minibus', keywords: ['bus', 'minibus', 'van'] },
  '🛻': { name: 'pickup truck', keywords: ['pick-up', 'pickup', 'truck'] },
  '🚚': { name: 'delivery truck', keywords: ['delivery', 'truck'] },
  '🚛': { name: 'articulated lorry', keywords: ['lorry', 'semi', 'truck'] },
  '🚜': { name: 'tractor', keywords: ['tractor', 'vehicle'] },
  '🏍️': { name: 'motorcycle', keywords: ['motorcycle', 'racing'] },
  '🛵': { name: 'motor scooter', keywords: ['motor', 'scooter'] },
  '🚲': { name: 'bicycle', keywords: ['bicycle', 'bike'] },
  '🛴': { name: 'kick scooter', keywords: ['kick', 'scooter'] },
  '🛹': { name: 'skateboard', keywords: ['board', 'skateboard'] },
  '🛼': { name: 'roller skate', keywords: ['roller', 'skate'] },
  '🚁': { name: 'helicopter', keywords: ['helicopter', 'vehicle'] },
  '🛸': { name: 'flying saucer', keywords: ['flying', 'saucer', 'ufo'] },
  '✈️': { name: 'airplane', keywords: ['aeroplane', 'airplane'] },
  '🛩️': { name: 'small airplane', keywords: ['aeroplane', 'airplane', 'small'] },
  '🪂': { name: 'parachute', keywords: ['hang-glide', 'parachute', 'parasail', 'skydive'] },
  '⛵': { name: 'sailboat', keywords: ['boat', 'resort', 'sailboat', 'yacht'] },
  '🚤': { name: 'speedboat', keywords: ['boat', 'speedboat'] },
  '🛥️': { name: 'motor boat', keywords: ['boat', 'motorboat'] },
  '🛳️': { name: 'passenger ship', keywords: ['passenger', 'ship'] },
  '⛴️': { name: 'ferry', keywords: ['boat', 'ferry'] },
  '🚢': { name: 'ship', keywords: ['ship', 'vehicle'] },

  // Objects & Symbols
  '⌚': { name: 'watch', keywords: ['clock', 'watch'] },
  '📱': { name: 'mobile phone', keywords: ['cell', 'mobile', 'phone', 'telephone'] },
  '📲': { name: 'mobile phone with arrow', keywords: ['call', 'cell', 'mobile', 'phone', 'receive'] },
  '💻': { name: 'laptop', keywords: ['computer', 'laptop', 'pc', 'personal'] },
  '⌨️': { name: 'keyboard', keywords: ['computer', 'keyboard'] },
  '🖥️': { name: 'desktop computer', keywords: ['computer', 'desktop'] },
  '🖨️': { name: 'printer', keywords: ['computer', 'printer'] },
  '🖱️': { name: 'computer mouse', keywords: ['computer', 'mouse'] },
  '🖲️': { name: 'trackball', keywords: ['computer', 'trackball'] },
  '🕹️': { name: 'joystick', keywords: ['game', 'joystick', 'video game'] },
  '🗜️': { name: 'clamp', keywords: ['clamp', 'compress', 'vice'] },
  '💽': { name: 'computer disk', keywords: ['computer', 'disk', 'minidisk', 'optical'] },
  '💾': { name: 'floppy disk', keywords: ['computer', 'disk', 'floppy'] },
  '💿': { name: 'optical disk', keywords: ['cd', 'computer', 'disk', 'optical'] },
  '📀': { name: 'dvd', keywords: ['blu-ray', 'computer', 'disk', 'dvd', 'optical'] },
  '📼': { name: 'videocassette', keywords: ['tape', 'video', 'videocassette', 'vhs'] },
  '📷': { name: 'camera', keywords: ['camera', 'video'] },
  '📸': { name: 'camera with flash', keywords: ['camera', 'flash', 'video'] },
  '📹': { name: 'video camera', keywords: ['camera', 'video'] },
  '🎥': { name: 'movie camera', keywords: ['camera', 'cinema', 'movie'] },
  '📽️': { name: 'film projector', keywords: ['cinema', 'film', 'movie', 'projector'] },
  '🎞️': { name: 'film frames', keywords: ['cinema', 'film', 'frames', 'movie'] },
  '📞': { name: 'telephone receiver', keywords: ['phone', 'receiver', 'telephone'] },
  '☎️': { name: 'telephone', keywords: ['phone', 'telephone'] },
  '📟': { name: 'pager', keywords: ['pager'] },
  '📠': { name: 'fax machine', keywords: ['fax'] },
  '📺': { name: 'television', keywords: ['television', 'tv', 'video'] },
  '📻': { name: 'radio', keywords: ['radio', 'video'] },
  '🎙️': { name: 'studio microphone', keywords: ['mic', 'microphone', 'studio'] },
  '🎚️': { name: 'level slider', keywords: ['level', 'music', 'slider'] },
  '🎛️': { name: 'control knobs', keywords: ['control', 'knobs', 'music'] },
  '🧭': { name: 'compass', keywords: ['compass', 'magnetic', 'navigation'] },
  '⏱️': { name: 'stopwatch', keywords: ['clock', 'stopwatch'] },
  '⏲️': { name: 'timer clock', keywords: ['clock', 'timer'] },
  '⏰': { name: 'alarm clock', keywords: ['alarm', 'clock'] },
  '🕰️': { name: 'mantelpiece clock', keywords: ['clock'] },
  '⌛': { name: 'hourglass done', keywords: ['hourglass', 'sand', 'timer'] },
  '⏳': { name: 'hourglass not done', keywords: ['hourglass', 'sand', 'timer'] },
  '📡': { name: 'satellite antenna', keywords: ['antenna', 'communication', 'dish', 'satellite'] },
  '🔋': { name: 'battery', keywords: ['battery'] },
  '🔌': { name: 'electric plug', keywords: ['electric', 'electricity', 'plug'] },
  '💡': { name: 'light bulb', keywords: ['bulb', 'comic', 'electric', 'idea', 'light'] },
  '🔦': { name: 'flashlight', keywords: ['electric', 'flashlight', 'light', 'tool', 'torch'] },
  '🕯️': { name: 'candle', keywords: ['candle', 'light'] },
  '🪔': { name: 'diya lamp', keywords: ['diya', 'lamp', 'oil'] },
  '🧯': { name: 'fire extinguisher', keywords: ['extinguish', 'fire', 'quench'] },
  '🛢️': { name: 'oil drum', keywords: ['drum', 'oil'] },
  '💸': { name: 'money with wings', keywords: ['bank', 'banknote', 'bill', 'fly', 'money', 'wings'] },
  '💵': { name: 'dollar banknote', keywords: ['bank', 'banknote', 'bill', 'currency', 'dollar', 'money'] },
  '💴': { name: 'yen banknote', keywords: ['bank', 'banknote', 'bill', 'currency', 'money', 'yen'] },
  '💶': { name: 'euro banknote', keywords: ['bank', 'banknote', 'bill', 'currency', 'euro', 'money'] },
  '💷': { name: 'pound banknote', keywords: ['bank', 'banknote', 'bill', 'currency', 'money', 'pound'] },
  '🪙': { name: 'coin', keywords: ['coin', 'gold', 'metal', 'money', 'silver', 'treasure'] },
  '💰': { name: 'money bag', keywords: ['bag', 'dollar', 'money', 'moneybag'] },
  '💳': { name: 'credit card', keywords: ['bank', 'card', 'credit', 'money', 'payment'] },
  '⚖️': { name: 'balance scale', keywords: ['balance', 'justice', 'libra', 'scale', 'weight', 'zodiac'] },
  '🪜': { name: 'ladder', keywords: ['climb', 'ladder', 'rung', 'step'] },
  '🧰': { name: 'toolbox', keywords: ['chest', 'mechanic', 'tool', 'toolbox'] },
  '🔧': { name: 'wrench', keywords: ['spanner', 'tool', 'wrench'] },
  '🔨': { name: 'hammer', keywords: ['hammer', 'tool'] },
  '⚒️': { name: 'hammer and pick', keywords: ['hammer', 'pick', 'tool'] },
  '🛠️': { name: 'hammer and wrench', keywords: ['hammer', 'spanner', 'tool', 'wrench'] },
  '⛏️': { name: 'pick', keywords: ['mining', 'pick', 'tool'] }
}

// Create a searchable emoji database with comprehensive keywords
const createEmojiDatabase = () => {
  const database: Array<{ emoji: string, name: string, keywords: string[], category: string }> = []

  EMOJI_GROUPS.forEach(group => {
    group.emojis.forEach(emoji => {
      const emojiData = EMOJI_DATA[emoji]
      const keywords = [...(emojiData?.keywords || [])]

      // Add category name as keyword
      keywords.push(group.name.toLowerCase())

      // Add generic keywords based on category
      if (group.name.includes('Hearts')) keywords.push('love', 'heart')
      if (group.name.includes('Smileys')) keywords.push('happy', 'smile', 'face')
      if (group.name.includes('Gestures')) keywords.push('hand', 'gesture')
      if (group.name.includes('Celebration')) keywords.push('party', 'celebrate')
      if (group.name.includes('Nature')) keywords.push('nature', 'natural')
      if (group.name.includes('Food')) keywords.push('food', 'eat', 'sweet')
      if (group.name.includes('Animals')) keywords.push('animal', 'pet')
      if (group.name.includes('Travel')) keywords.push('travel', 'transport')
      if (group.name.includes('Objects')) keywords.push('object', 'thing')

      database.push({
        emoji,
        name: emojiData?.name || emoji,
        keywords,
        category: group.name
      })
    })
  })

  return database
}

const EMOJI_DATABASE = createEmojiDatabase()

// Get recently used emojis from localStorage
const getRecentlyUsedEmojis = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const recent = localStorage.getItem('grateful_recent_emojis')
    return recent ? JSON.parse(recent) : []
  } catch {
    return []
  }
}

// Save emoji to recently used
const saveRecentlyUsedEmoji = (emoji: string) => {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentlyUsedEmojis()
    const filtered = recent.filter(e => e !== emoji)
    const updated = [emoji, ...filtered].slice(0, 16) // Keep max 16 recent emojis
    localStorage.setItem('grateful_recent_emojis', JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

export default function MinimalEmojiPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  position = { x: 0, y: 0 },
  anchorGap = 8,
  variant = 'floating',
  viewportInset = 0,
  className = ""
}: MinimalEmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEmojis, setFilteredEmojis] = useState<string[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('Recently Used')

  const contentRef = useRef<HTMLDivElement>(null)

  // Load recently used emojis when component mounts
  useEffect(() => {
    if (isOpen) {
      setRecentEmojis(getRecentlyUsedEmojis())
      setSearchQuery('') // Reset search when opening
      setFilteredEmojis([])
      setShowSearch(false)
      setActiveCategory('Recently Used')
    }
  }, [isOpen])

  // Handle search filtering with enhanced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmojis([])
      return
    }

    const query = searchQuery.toLowerCase().trim()
    const matches = EMOJI_DATABASE.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
      item.category.toLowerCase().includes(query)
    ).map(item => item.emoji)

    // Remove duplicates and limit results
    const uniqueMatches = Array.from(new Set(matches)).slice(0, 32)
    setFilteredEmojis(uniqueMatches)
  }, [searchQuery])

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    saveRecentlyUsedEmoji(emoji)
    setRecentEmojis(getRecentlyUsedEmojis()) // Update recent emojis immediately
    onEmojiSelect(emoji)
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Scroll to category section with proper positioning
  const scrollToCategory = (categoryName: string) => {
    if (!contentRef.current) return

    const categoryElement = contentRef.current.querySelector(`[data-category="${categoryName}"]`)
    if (categoryElement && contentRef.current) {
      // Calculate the position relative to the scrollable container
      const containerRect = contentRef.current.getBoundingClientRect()
      const elementRect = categoryElement.getBoundingClientRect()
      const relativeTop = elementRect.top - containerRect.top + contentRef.current.scrollTop

      // Scroll to position with some padding from the top
      contentRef.current.scrollTo({
        top: Math.max(0, relativeTop - 8), // 8px padding from top
        behavior: 'smooth'
      })
      setActiveCategory(categoryName)
    }
  }

  const getPickerHeight = () => {
    if (typeof window === 'undefined') return '280px'

    const isMobile = window.innerWidth < 768
    const viewportHeight = window.visualViewport?.height || window.innerHeight

    if (isMobile) {
      const availableHeight = Math.max(220, viewportHeight - Math.max(0, viewportInset) - 180)
      const maxMobileHeight = Math.min(340, viewportHeight * 0.42, availableHeight)
      return `${Math.max(220, maxMobileHeight)}px`
    }

    return '320px'
  }

  const getContentHeight = () => {
    const pickerHeight = parseInt(getPickerHeight(), 10)
    const searchHeight = showSearch ? 52 : 0
    const contentHeight = pickerHeight - searchHeight - 68
    return `${contentHeight}px`
  }

  const handleSearchToggle = () => {
    setShowSearch(prev => {
      const next = !prev
      if (!next) {
        setSearchQuery('')
        setFilteredEmojis([])
      } else {
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
      return next
    })
  }

  // Floating mode keeps legacy outside-click behavior. Inline mode relies on the host surface.
  useEffect(() => {
    if (variant !== 'floating') return

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, variant])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (searchQuery.trim()) {
          // Clear search first, then close on second escape
          setSearchQuery('')
          setFilteredEmojis([])
        } else if (showSearch) {
          setShowSearch(false)
        } else {
          onClose()
        }
      }
      // Allow other keys to bubble up for normal input handling
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, searchQuery, showSearch])

  if (!isOpen) return null

  const pickerShellClassName = variant === 'inline'
    ? `relative w-full rounded-2xl border border-gray-200 bg-white shadow-lg ${className}`.trim()
    : `fixed z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ${className}`.trim()

  const pickerStyle = variant === 'inline'
    ? {
        maxHeight: getPickerHeight(),
      }
    : {
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: typeof window !== 'undefined' ? window.innerHeight - position.y + anchorGap : 0,
        width: 'min(calc(100vw - 32px), 672px)',
        maxHeight: typeof window !== 'undefined' ? Math.min(parseInt(getPickerHeight(), 10), position.y - 16) : getPickerHeight(),
      }

  return (
    <>
      {variant === 'floating' && <div className="fixed inset-0 z-50" onClick={onClose} />}

      <div
        ref={pickerRef}
        data-minimal-emoji-picker
        className={pickerShellClassName}
        style={pickerStyle}
        onMouseDown={variant === 'floating'
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
            }
          : undefined}
      >
        {showSearch && (
          <div className="border-b border-gray-100 px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              {/* getCompleteInputStyling() is required here to prevent transparent text bugs on mobile WebKit */}
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search emojis"
                value={searchQuery}
                onChange={handleSearchChange}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
                className={`w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 ${getCompleteInputStyling().className}`}
                style={{ ...getCompleteInputStyling().style, backgroundColor: '#f9fafb' }} // Preserve bg-gray-50
              />
            </div>
          </div>
        )}

        <div
          ref={contentRef}
          className="overflow-y-auto px-3 pt-3 pb-20"
          style={{ maxHeight: getContentHeight() }}
        >
          {searchQuery.trim() && (
            <div className="space-y-3">
              {filteredEmojis.length > 0 ? (
                <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
                  {filteredEmojis.map((emoji, index) => (
                    <button
                      key={`search-${emoji}-${index}`}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEmojiSelect(emoji)
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[1.65rem] transition hover:bg-purple-50 active:scale-95 sm:h-11 sm:w-11"
                      style={{ minHeight: '40px', minWidth: '40px' }}
                      title={EMOJI_DATABASE.find(item => item.emoji === emoji)?.name || emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">
                  No emojis found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}

          {!searchQuery.trim() && (
            <>
              {recentEmojis.length > 0 && (
                <div className="mb-4" data-category="Recently Used">
                  <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400">
                    Recently Used
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
                    {recentEmojis.slice(0, 32).map((emoji, index) => (
                      <button
                        key={`recent-${emoji}-${index}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleEmojiSelect(emoji)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[1.65rem] transition hover:bg-purple-50 active:scale-95 sm:h-11 sm:w-11"
                        style={{ minHeight: '40px', minWidth: '40px' }}
                        title={EMOJI_DATABASE.find(item => item.emoji === emoji)?.name || emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {EMOJI_GROUPS.map((group) => (
                <div key={group.name} className="mb-4" data-category={group.name}>
                  <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400">
                    {group.name}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleEmojiSelect(emoji)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[1.65rem] transition hover:bg-purple-50 active:scale-95 sm:h-11 sm:w-11"
                        style={{ minHeight: '40px', minWidth: '40px' }}
                        title={EMOJI_DATABASE.find(item => item.emoji === emoji)?.name || emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3">
          <div className="pointer-events-auto rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur">
            <div
              className="flex items-center gap-1 overflow-x-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSearchToggle()
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition ${
                  showSearch ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label={showSearch ? "Hide emoji search" : "Show emoji search"}
              >
                <Search className="h-4 w-4" />
              </button>

              {recentEmojis.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    scrollToCategory('Recently Used')
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg transition ${
                    activeCategory === 'Recently Used' ? 'bg-purple-100' : 'hover:bg-gray-100'
                  }`}
                  title="Recently used"
                  aria-label="Recently used emojis"
                >
                  <History className="h-4 w-4" />
                </button>
              )}

              {EMOJI_GROUPS.map((group) => {
                const IconComponent = group.icon

                return (
                  <button
                    key={group.name}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      scrollToCategory(group.name)
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition ${
                      activeCategory === group.name ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={group.name}
                    aria-label={group.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
