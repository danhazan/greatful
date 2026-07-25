/**
 * Canonical frontend reaction inventory and helpers.
 *
 * This is the single source of truth for reaction codes, Unicode characters,
 * labels, groups, legacy mappings, and resolution logic.
 *
 * The backend treats emoji_code as an opaque string and does not maintain
 * any inventory knowledge.
 */

export interface ReactionItem {
  code: string;
  character: string;
  label: string;
  group: string;
}

export const REACTION_INVENTORY: ReactionItem[] = [
  {
    "code": "heart",
    "character": "💜",
    "label": "Heart",
    "group": "heart"
  },
  {
    "code": "red_heart",
    "character": "❤️",
    "label": "Red Heart",
    "group": "heart"
  },
  {
    "code": "orange_heart",
    "character": "🧡",
    "label": "Orange Heart",
    "group": "heart"
  },
  {
    "code": "yellow_heart",
    "character": "💛",
    "label": "Yellow Heart",
    "group": "heart"
  },
  {
    "code": "green_heart",
    "character": "💚",
    "label": "Green Heart",
    "group": "heart"
  },
  {
    "code": "blue_heart",
    "character": "💙",
    "label": "Blue Heart",
    "group": "heart"
  },
  {
    "code": "purple_heart",
    "character": "💜",
    "label": "Purple Heart",
    "group": "heart"
  },
  {
    "code": "brown_heart",
    "character": "🤎",
    "label": "Brown Heart",
    "group": "heart"
  },
  {
    "code": "black_heart",
    "character": "🖤",
    "label": "Black Heart",
    "group": "heart"
  },
  {
    "code": "white_heart",
    "character": "🤍",
    "label": "White Heart",
    "group": "heart"
  },
  {
    "code": "sparkling_heart",
    "character": "💖",
    "label": "Sparkling",
    "group": "heart"
  },
  {
    "code": "two_hearts",
    "character": "💕",
    "label": "Two Hearts",
    "group": "heart"
  },
  {
    "code": "revolving_hearts",
    "character": "💞",
    "label": "Revolving Hearts",
    "group": "heart"
  },
  {
    "code": "heartbeat",
    "character": "💓",
    "label": "Heartbeat",
    "group": "heart"
  },
  {
    "code": "growing_heart",
    "character": "💗",
    "label": "Growing Heart",
    "group": "heart"
  },
  {
    "code": "heart_on_fire",
    "character": "❤️‍🔥",
    "label": "Heart on Fire",
    "group": "heart"
  },
  {
    "code": "cupid",
    "character": "💘",
    "label": "Cupid",
    "group": "heart"
  },
  {
    "code": "gift_heart",
    "character": "💝",
    "label": "Gift Heart",
    "group": "heart"
  },
  {
    "code": "heart_decoration",
    "character": "💟",
    "label": "Heart Decoration",
    "group": "heart"
  },
  {
    "code": "heart_exclamation",
    "character": "❣️",
    "label": "Heart Exclamation",
    "group": "heart"
  },
  {
    "code": "love_letter",
    "character": "💌",
    "label": "Love Letter",
    "group": "heart"
  },
  {
    "code": "kiss_mark",
    "character": "💋",
    "label": "Kiss Mark",
    "group": "heart"
  },
  {
    "code": "lips",
    "character": "👄",
    "label": "Lips",
    "group": "heart"
  },
  {
    "code": "ring",
    "character": "💍",
    "label": "Ring",
    "group": "heart"
  },
  {
    "code": "grinning",
    "character": "😀",
    "label": "Grinning",
    "group": "face"
  },
  {
    "code": "smiley",
    "character": "😃",
    "label": "Smiley",
    "group": "face"
  },
  {
    "code": "smile",
    "character": "😄",
    "label": "Smile",
    "group": "face"
  },
  {
    "code": "beaming",
    "character": "😁",
    "label": "Beaming",
    "group": "face"
  },
  {
    "code": "laughing",
    "character": "😆",
    "label": "Laughing",
    "group": "face"
  },
  {
    "code": "sweat_smile",
    "character": "😅",
    "label": "Relieved",
    "group": "face"
  },
  {
    "code": "joy",
    "character": "😂",
    "label": "Joy",
    "group": "face"
  },
  {
    "code": "rolling_on_floor",
    "character": "🤣",
    "label": "ROFL",
    "group": "face"
  },
  {
    "code": "slightly_smiling",
    "character": "🙂",
    "label": "Smile",
    "group": "face"
  },
  {
    "code": "upside_down",
    "character": "🙃",
    "label": "Silly",
    "group": "face"
  },
  {
    "code": "wink",
    "character": "😉",
    "label": "Wink",
    "group": "face"
  },
  {
    "code": "blush",
    "character": "😊",
    "label": "Blush",
    "group": "face"
  },
  {
    "code": "innocent",
    "character": "😇",
    "label": "Innocent",
    "group": "face"
  },
  {
    "code": "heart_eyes",
    "character": "😍",
    "label": "Love it",
    "group": "face"
  },
  {
    "code": "heart_face",
    "character": "🥰",
    "label": "Adore",
    "group": "face"
  },
  {
    "code": "starstruck",
    "character": "🤩",
    "label": "Starstruck",
    "group": "face"
  },
  {
    "code": "kissing_heart",
    "character": "😘",
    "label": "Kissing Heart",
    "group": "face"
  },
  {
    "code": "kissing",
    "character": "😗",
    "label": "Kissing",
    "group": "face"
  },
  {
    "code": "warm_smile",
    "character": "☺️",
    "label": "Warm Smile",
    "group": "face"
  },
  {
    "code": "kissing_closed_eyes",
    "character": "😚",
    "label": "Kissing Eyes Closed",
    "group": "face"
  },
  {
    "code": "kissing_smiling_eyes",
    "character": "😙",
    "label": "Kissing Smile",
    "group": "face"
  },
  {
    "code": "touched",
    "character": "🥹",
    "label": "Grateful",
    "group": "face"
  },
  {
    "code": "holding_back_tears",
    "character": "🥲",
    "label": "Touched",
    "group": "face"
  },
  {
    "code": "yum",
    "character": "😋",
    "label": "Yum",
    "group": "face"
  },
  {
    "code": "stuck_out_tongue",
    "character": "😛",
    "label": "Tongue Out",
    "group": "face"
  },
  {
    "code": "stuck_out_tongue_winking_eye",
    "character": "😜",
    "label": "Playful",
    "group": "face"
  },
  {
    "code": "zany_face",
    "character": "🤪",
    "label": "Zany",
    "group": "face"
  },
  {
    "code": "stuck_out_tongue_closed_eyes",
    "character": "😝",
    "label": "Silly",
    "group": "face"
  },
  {
    "code": "hug",
    "character": "🤗",
    "label": "Hug",
    "group": "face"
  },
  {
    "code": "face_with_hand",
    "character": "🤭",
    "label": "Oops",
    "group": "face"
  },
  {
    "code": "shushing_face",
    "character": "🤫",
    "label": "Shush",
    "group": "face"
  },
  {
    "code": "thinking",
    "character": "🤔",
    "label": "Thinking",
    "group": "face"
  },
  {
    "code": "face_with_raised_eyebrow",
    "character": "🤨",
    "label": "Suspicious",
    "group": "face"
  },
  {
    "code": "neutral_face",
    "character": "😐",
    "label": "Neutral",
    "group": "face"
  },
  {
    "code": "expressionless",
    "character": "😑",
    "label": "Expressionless",
    "group": "face"
  },
  {
    "code": "face_without_mouth",
    "character": "😶",
    "label": "Silent",
    "group": "face"
  },
  {
    "code": "smirk",
    "character": "😏",
    "label": "Smirk",
    "group": "face"
  },
  {
    "code": "unamused",
    "character": "😒",
    "label": "Unamused",
    "group": "face"
  },
  {
    "code": "face_with_rolling_eyes",
    "character": "🙄",
    "label": "Eye Roll",
    "group": "face"
  },
  {
    "code": "grimacing",
    "character": "😬",
    "label": "Grimace",
    "group": "face"
  },
  {
    "code": "relieved",
    "character": "😌",
    "label": "Relieved",
    "group": "face"
  },
  {
    "code": "pensive",
    "character": "😔",
    "label": "Pensive",
    "group": "face"
  },
  {
    "code": "sleepy",
    "character": "😪",
    "label": "Sleepy",
    "group": "face"
  },
  {
    "code": "drooling",
    "character": "🤤",
    "label": "Drooling",
    "group": "face"
  },
  {
    "code": "sleeping",
    "character": "😴",
    "label": "Sleeping",
    "group": "face"
  },
  {
    "code": "dizzy_face",
    "character": "😵",
    "label": "Dizzy",
    "group": "face"
  },
  {
    "code": "mind_blown",
    "character": "🤯",
    "label": "Mind Blown",
    "group": "face"
  },
  {
    "code": "flushed",
    "character": "😳",
    "label": "Flushed",
    "group": "face"
  },
  {
    "code": "pleading",
    "character": "🥺",
    "label": "Pleading",
    "group": "face"
  },
  {
    "code": "partying_face",
    "character": "🥳",
    "label": "Celebrate",
    "group": "face"
  },
  {
    "code": "cool",
    "character": "😎",
    "label": "Cool",
    "group": "face"
  },
  {
    "code": "nerd_face",
    "character": "🤓",
    "label": "Nerd",
    "group": "face"
  },
  {
    "code": "face_with_monocle",
    "character": "🧐",
    "label": "Curious",
    "group": "face"
  },
  {
    "code": "cowboy_hat_face",
    "character": "🤠",
    "label": "Cowboy",
    "group": "face"
  },
  {
    "code": "salute",
    "character": "🫡",
    "label": "Salute",
    "group": "face"
  },
  {
    "code": "hugging_people",
    "character": "🫂",
    "label": "Hugging",
    "group": "face"
  },
  {
    "code": "face_with_open_mouth",
    "character": "😮",
    "label": "Surprised",
    "group": "face"
  },
  {
    "code": "hushed",
    "character": "😯",
    "label": "Hushed",
    "group": "face"
  },
  {
    "code": "astonished",
    "character": "😲",
    "label": "Astonished",
    "group": "face"
  },
  {
    "code": "crying",
    "character": "😢",
    "label": "Crying",
    "group": "face"
  },
  {
    "code": "loudly_crying",
    "character": "😭",
    "label": "Sobbing",
    "group": "face"
  },
  {
    "code": "baby",
    "character": "👶",
    "label": "Baby",
    "group": "face"
  },
  {
    "code": "child",
    "character": "🧒",
    "label": "Child",
    "group": "face"
  },
  {
    "code": "boy",
    "character": "👦",
    "label": "Boy",
    "group": "face"
  },
  {
    "code": "girl",
    "character": "👧",
    "label": "Girl",
    "group": "face"
  },
  {
    "code": "adult",
    "character": "🧑",
    "label": "Adult",
    "group": "face"
  },
  {
    "code": "older_adult",
    "character": "🧓",
    "label": "Older Adult",
    "group": "face"
  },
  {
    "code": "man",
    "character": "👨",
    "label": "Man",
    "group": "face"
  },
  {
    "code": "woman",
    "character": "👩",
    "label": "Woman",
    "group": "face"
  },
  {
    "code": "person_blond_hair",
    "character": "👱",
    "label": "Blond",
    "group": "face"
  },
  {
    "code": "bearded_person",
    "character": "🧔",
    "label": "Bearded",
    "group": "face"
  },
  {
    "code": "man_red_hair",
    "character": "👨‍🦰",
    "label": "Man Red Hair",
    "group": "face"
  },
  {
    "code": "man_curly_hair",
    "character": "👨‍🦱",
    "label": "Man Curly Hair",
    "group": "face"
  },
  {
    "code": "man_white_hair",
    "character": "👨‍🦳",
    "label": "Man White Hair",
    "group": "face"
  },
  {
    "code": "man_bald",
    "character": "👨‍🦲",
    "label": "Man Bald",
    "group": "face"
  },
  {
    "code": "woman_red_hair",
    "character": "👩‍🦰",
    "label": "Woman Red Hair",
    "group": "face"
  },
  {
    "code": "woman_curly_hair",
    "character": "👩‍🦱",
    "label": "Woman Curly Hair",
    "group": "face"
  },
  {
    "code": "woman_white_hair",
    "character": "👩‍🦳",
    "label": "Woman White Hair",
    "group": "face"
  },
  {
    "code": "woman_bald",
    "character": "👩‍🦲",
    "label": "Woman Bald",
    "group": "face"
  },
  {
    "code": "thumbs_up",
    "character": "👍",
    "label": "Thumbs Up",
    "group": "hands"
  },
  {
    "code": "ok_hand",
    "character": "👌",
    "label": "OK",
    "group": "hands"
  },
  {
    "code": "pinched_fingers",
    "character": "🤌",
    "label": "Pinched",
    "group": "hands"
  },
  {
    "code": "pinching_hand",
    "character": "🤏",
    "label": "Pinching",
    "group": "hands"
  },
  {
    "code": "peace",
    "character": "✌️",
    "label": "Peace",
    "group": "hands"
  },
  {
    "code": "crossed_fingers",
    "character": "🤞",
    "label": "Fingers Crossed",
    "group": "hands"
  },
  {
    "code": "love_you_gesture",
    "character": "🤟",
    "label": "Love You",
    "group": "hands"
  },
  {
    "code": "sign_of_the_horns",
    "character": "🤘",
    "label": "Rock On",
    "group": "hands"
  },
  {
    "code": "call_me",
    "character": "🤙",
    "label": "Call Me",
    "group": "hands"
  },
  {
    "code": "index_pointing_up",
    "character": "☝️",
    "label": "Pointing Up",
    "group": "hands"
  },
  {
    "code": "backhand_index_pointing_up",
    "character": "👆",
    "label": "Point Up",
    "group": "hands"
  },
  {
    "code": "backhand_index_pointing_down",
    "character": "👇",
    "label": "Point Down",
    "group": "hands"
  },
  {
    "code": "backhand_index_pointing_left",
    "character": "👈",
    "label": "Point Left",
    "group": "hands"
  },
  {
    "code": "backhand_index_pointing_right",
    "character": "👉",
    "label": "Point Right",
    "group": "hands"
  },
  {
    "code": "wave",
    "character": "👋",
    "label": "Wave",
    "group": "hands"
  },
  {
    "code": "raised_back_of_hand",
    "character": "🖐️",
    "label": "Raised Hand",
    "group": "hands"
  },
  {
    "code": "raised_hand",
    "character": "✋",
    "label": "Raised Hand",
    "group": "hands"
  },
  {
    "code": "vulcan_salute",
    "character": "🖖",
    "label": "Salute",
    "group": "hands"
  },
  {
    "code": "clap",
    "character": "👏",
    "label": "Applause",
    "group": "hands"
  },
  {
    "code": "praise",
    "character": "🙌",
    "label": "Praise",
    "group": "hands"
  },
  {
    "code": "palms_up_together",
    "character": "🤲",
    "label": "Palms Up",
    "group": "hands"
  },
  {
    "code": "handshake",
    "character": "🤝",
    "label": "Handshake",
    "group": "hands"
  },
  {
    "code": "grateful",
    "character": "🙏",
    "label": "Thankful",
    "group": "hands"
  },
  {
    "code": "writing_hand",
    "character": "✍️",
    "label": "Writing",
    "group": "hands"
  },
  {
    "code": "nail_polish",
    "character": "💅",
    "label": "Nail Polish",
    "group": "hands"
  },
  {
    "code": "selfie",
    "character": "🤳",
    "label": "Selfie",
    "group": "hands"
  },
  {
    "code": "muscle",
    "character": "💪",
    "label": "Strong",
    "group": "hands"
  },
  {
    "code": "heart_hands",
    "character": "🫶",
    "label": "Heart Hands",
    "group": "hands"
  },
  {
    "code": "open_hands",
    "character": "👐",
    "label": "Open Hands",
    "group": "hands"
  },
  {
    "code": "left_facing_fist",
    "character": "🤛",
    "label": "Fist Bump",
    "group": "hands"
  },
  {
    "code": "right_facing_fist",
    "character": "🤜",
    "label": "Fist Bump",
    "group": "hands"
  },
  {
    "code": "sun",
    "character": "☀️",
    "label": "Sunshine",
    "group": "nature"
  },
  {
    "code": "sun_with_face",
    "character": "🌞",
    "label": "Sun with Face",
    "group": "nature"
  },
  {
    "code": "full_moon",
    "character": "🌝",
    "label": "Full Moon",
    "group": "nature"
  },
  {
    "code": "new_moon",
    "character": "🌑",
    "label": "New Moon",
    "group": "nature"
  },
  {
    "code": "waxing_crescent_moon",
    "character": "🌒",
    "label": "Waxing Crescent",
    "group": "nature"
  },
  {
    "code": "first_quarter_moon",
    "character": "🌓",
    "label": "First Quarter",
    "group": "nature"
  },
  {
    "code": "waxing_gibbous_moon",
    "character": "🌔",
    "label": "Waxing Gibbous",
    "group": "nature"
  },
  {
    "code": "waning_gibbous_moon",
    "character": "🌖",
    "label": "Waning Gibbous",
    "group": "nature"
  },
  {
    "code": "last_quarter_moon",
    "character": "🌗",
    "label": "Last Quarter",
    "group": "nature"
  },
  {
    "code": "waning_crescent_moon",
    "character": "🌘",
    "label": "Waning Crescent",
    "group": "nature"
  },
  {
    "code": "crescent_moon",
    "character": "🌙",
    "label": "Crescent Moon",
    "group": "nature"
  },
  {
    "code": "new_moon_face",
    "character": "🌚",
    "label": "New Moon Face",
    "group": "nature"
  },
  {
    "code": "last_quarter_moon_face",
    "character": "🌛",
    "label": "Last Quarter Face",
    "group": "nature"
  },
  {
    "code": "first_quarter_moon_face",
    "character": "🌜",
    "label": "First Quarter Face",
    "group": "nature"
  },
  {
    "code": "star",
    "character": "⭐",
    "label": "Star",
    "group": "nature"
  },
  {
    "code": "glowing_star",
    "character": "🌟",
    "label": "Glowing Star",
    "group": "nature"
  },
  {
    "code": "dizzy",
    "character": "💫",
    "label": "Dizzy",
    "group": "nature"
  },
  {
    "code": "sparkles",
    "character": "✨",
    "label": "Sparkles",
    "group": "nature"
  },
  {
    "code": "rainbow",
    "character": "🌈",
    "label": "Rainbow",
    "group": "nature"
  },
  {
    "code": "cloud",
    "character": "☁️",
    "label": "Cloud",
    "group": "nature"
  },
  {
    "code": "sun_behind_cloud",
    "character": "⛅",
    "label": "Sun Behind Cloud",
    "group": "nature"
  },
  {
    "code": "sun_behind_small_cloud",
    "character": "🌤️",
    "label": "Sun Behind Small Cloud",
    "group": "nature"
  },
  {
    "code": "sun_behind_large_cloud",
    "character": "🌥️",
    "label": "Sun Behind Large Cloud",
    "group": "nature"
  },
  {
    "code": "snowflake",
    "character": "❄️",
    "label": "Snowflake",
    "group": "nature"
  },
  {
    "code": "droplet",
    "character": "💧",
    "label": "Droplet",
    "group": "nature"
  },
  {
    "code": "water_wave",
    "character": "🌊",
    "label": "Wave",
    "group": "nature"
  },
  {
    "code": "wind",
    "character": "💨",
    "label": "Wind",
    "group": "nature"
  },
  {
    "code": "earth_americas",
    "character": "🌎",
    "label": "Earth",
    "group": "nature"
  },
  {
    "code": "earth_africa",
    "character": "🌍",
    "label": "Earth Africa",
    "group": "nature"
  },
  {
    "code": "earth_asia",
    "character": "🌏",
    "label": "Earth Asia",
    "group": "nature"
  },
  {
    "code": "seedling",
    "character": "🌱",
    "label": "Seedling",
    "group": "nature"
  },
  {
    "code": "herb",
    "character": "🌿",
    "label": "Herb",
    "group": "nature"
  },
  {
    "code": "leaf",
    "character": "🍃",
    "label": "Leaf",
    "group": "nature"
  },
  {
    "code": "fallen_leaf",
    "character": "🍂",
    "label": "Fallen Leaf",
    "group": "nature"
  },
  {
    "code": "maple_leaf",
    "character": "🍁",
    "label": "Maple Leaf",
    "group": "nature"
  },
  {
    "code": "evergreen_tree",
    "character": "🌲",
    "label": "Evergreen",
    "group": "nature"
  },
  {
    "code": "deciduous_tree",
    "character": "🌳",
    "label": "Tree",
    "group": "nature"
  },
  {
    "code": "palm_tree",
    "character": "🌴",
    "label": "Palm Tree",
    "group": "nature"
  },
  {
    "code": "cactus",
    "character": "🌵",
    "label": "Cactus",
    "group": "nature"
  },
  {
    "code": "sheaf_of_rice",
    "character": "🌾",
    "label": "Rice",
    "group": "nature"
  },
  {
    "code": "sunflower",
    "character": "🌻",
    "label": "Sunflower",
    "group": "nature"
  },
  {
    "code": "rose",
    "character": "🌹",
    "label": "Rose",
    "group": "nature"
  },
  {
    "code": "wilted_flower",
    "character": "🥀",
    "label": "Wilted Flower",
    "group": "nature"
  },
  {
    "code": "hibiscus",
    "character": "🌺",
    "label": "Hibiscus",
    "group": "nature"
  },
  {
    "code": "cherry_blossom",
    "character": "🌸",
    "label": "Cherry Blossom",
    "group": "nature"
  },
  {
    "code": "tulip",
    "character": "🌷",
    "label": "Tulip",
    "group": "nature"
  },
  {
    "code": "blossom",
    "character": "🌼",
    "label": "Blossom",
    "group": "nature"
  },
  {
    "code": "lotus",
    "character": "🪷",
    "label": "Lotus",
    "group": "nature"
  },
  {
    "code": "four_leaf_clover",
    "character": "🍀",
    "label": "Lucky",
    "group": "nature"
  },
  {
    "code": "bouquet",
    "character": "💐",
    "label": "Bouquet",
    "group": "nature"
  },
  {
    "code": "mountain",
    "character": "⛰️",
    "label": "Mountain",
    "group": "nature"
  },
  {
    "code": "snow_capped_mountain",
    "character": "🏔️",
    "label": "Snow Mountain",
    "group": "nature"
  },
  {
    "code": "volcano",
    "character": "🌋",
    "label": "Volcano",
    "group": "nature"
  },
  {
    "code": "mount_fuji",
    "character": "🗻",
    "label": "Mount Fuji",
    "group": "nature"
  },
  {
    "code": "camping",
    "character": "🏕️",
    "label": "Camping",
    "group": "nature"
  },
  {
    "code": "beach",
    "character": "🏖️",
    "label": "Beach",
    "group": "nature"
  },
  {
    "code": "desert",
    "character": "🏜️",
    "label": "Desert",
    "group": "nature"
  },
  {
    "code": "island",
    "character": "🏝️",
    "label": "Island",
    "group": "nature"
  },
  {
    "code": "sunrise",
    "character": "🌅",
    "label": "Sunrise",
    "group": "nature"
  },
  {
    "code": "sunset",
    "character": "🌇",
    "label": "Sunset",
    "group": "nature"
  },
  {
    "code": "city_sunset",
    "character": "🌆",
    "label": "City Sunset",
    "group": "nature"
  },
  {
    "code": "city_night",
    "character": "🌃",
    "label": "Night Sky",
    "group": "nature"
  },
  {
    "code": "night_with_stars",
    "character": "🌌",
    "label": "Milky Way",
    "group": "nature"
  },
  {
    "code": "hot_springs",
    "character": "♨️",
    "label": "Hot Springs",
    "group": "nature"
  },
  {
    "code": "national_park",
    "character": "🏞️",
    "label": "National Park",
    "group": "nature"
  },
  {
    "code": "dog_face",
    "character": "🐶",
    "label": "Dog",
    "group": "animals"
  },
  {
    "code": "cat_face",
    "character": "🐱",
    "label": "Cat",
    "group": "animals"
  },
  {
    "code": "mouse_face",
    "character": "🐭",
    "label": "Mouse",
    "group": "animals"
  },
  {
    "code": "hamster",
    "character": "🐹",
    "label": "Hamster",
    "group": "animals"
  },
  {
    "code": "rabbit_face",
    "character": "🐰",
    "label": "Rabbit",
    "group": "animals"
  },
  {
    "code": "fox_face",
    "character": "🦊",
    "label": "Fox",
    "group": "animals"
  },
  {
    "code": "bear_face",
    "character": "🐻",
    "label": "Bear",
    "group": "animals"
  },
  {
    "code": "polar_bear",
    "character": "🐻‍❄️",
    "label": "Polar Bear",
    "group": "animals"
  },
  {
    "code": "panda_face",
    "character": "🐼",
    "label": "Panda",
    "group": "animals"
  },
  {
    "code": "koala",
    "character": "🐨",
    "label": "Koala",
    "group": "animals"
  },
  {
    "code": "tiger_face",
    "character": "🐯",
    "label": "Tiger",
    "group": "animals"
  },
  {
    "code": "lion_face",
    "character": "🦁",
    "label": "Lion",
    "group": "animals"
  },
  {
    "code": "cow_face",
    "character": "🐮",
    "label": "Cow",
    "group": "animals"
  },
  {
    "code": "pig_face",
    "character": "🐷",
    "label": "Pig",
    "group": "animals"
  },
  {
    "code": "pig_nose",
    "character": "🐽",
    "label": "Pig Nose",
    "group": "animals"
  },
  {
    "code": "frog",
    "character": "🐸",
    "label": "Frog",
    "group": "animals"
  },
  {
    "code": "raccoon",
    "character": "🦝",
    "label": "Raccoon",
    "group": "animals"
  },
  {
    "code": "horse_face",
    "character": "🐴",
    "label": "Horse",
    "group": "animals"
  },
  {
    "code": "unicorn_face",
    "character": "🦄",
    "label": "Unicorn",
    "group": "animals"
  },
  {
    "code": "monkey_face",
    "character": "🐵",
    "label": "Monkey",
    "group": "animals"
  },
  {
    "code": "see_no_evil",
    "character": "🙈",
    "label": "See No Evil",
    "group": "animals"
  },
  {
    "code": "hear_no_evil",
    "character": "🙉",
    "label": "Hear No Evil",
    "group": "animals"
  },
  {
    "code": "speak_no_evil",
    "character": "🙊",
    "label": "Speak No Evil",
    "group": "animals"
  },
  {
    "code": "monkey",
    "character": "🐒",
    "label": "Monkey",
    "group": "animals"
  },
  {
    "code": "butterfly",
    "character": "🦋",
    "label": "Butterfly",
    "group": "animals"
  },
  {
    "code": "bee",
    "character": "🐝",
    "label": "Bee",
    "group": "animals"
  },
  {
    "code": "ladybug",
    "character": "🐞",
    "label": "Ladybug",
    "group": "animals"
  },
  {
    "code": "snail",
    "character": "🐌",
    "label": "Snail",
    "group": "animals"
  },
  {
    "code": "chicken_face",
    "character": "🐔",
    "label": "Chicken",
    "group": "animals"
  },
  {
    "code": "penguin",
    "character": "🐧",
    "label": "Penguin",
    "group": "animals"
  },
  {
    "code": "bird",
    "character": "🐦",
    "label": "Bird",
    "group": "animals"
  },
  {
    "code": "chick",
    "character": "🐤",
    "label": "Chick",
    "group": "animals"
  },
  {
    "code": "hatching_chick",
    "character": "🐣",
    "label": "Hatching",
    "group": "animals"
  },
  {
    "code": "baby_chick",
    "character": "🐥",
    "label": "Baby Chick",
    "group": "animals"
  },
  {
    "code": "duck",
    "character": "🦆",
    "label": "Duck",
    "group": "animals"
  },
  {
    "code": "eagle",
    "character": "🦅",
    "label": "Eagle",
    "group": "animals"
  },
  {
    "code": "owl",
    "character": "🦉",
    "label": "Owl",
    "group": "animals"
  },
  {
    "code": "dove",
    "character": "🕊️",
    "label": "Peace",
    "group": "animals"
  },
  {
    "code": "dog",
    "character": "🐕",
    "label": "Dog",
    "group": "animals"
  },
  {
    "code": "cat",
    "character": "🐈",
    "label": "Cat",
    "group": "animals"
  },
  {
    "code": "rabbit",
    "character": "🐇",
    "label": "Rabbit",
    "group": "animals"
  },
  {
    "code": "hedgehog",
    "character": "🦔",
    "label": "Hedgehog",
    "group": "animals"
  },
  {
    "code": "squirrel",
    "character": "🐿️",
    "label": "Squirrel",
    "group": "animals"
  },
  {
    "code": "horse",
    "character": "🐎",
    "label": "Horse",
    "group": "animals"
  },
  {
    "code": "cow",
    "character": "🐄",
    "label": "Cow",
    "group": "animals"
  },
  {
    "code": "pig",
    "character": "🐖",
    "label": "Pig",
    "group": "animals"
  },
  {
    "code": "sheep",
    "character": "🐑",
    "label": "Sheep",
    "group": "animals"
  },
  {
    "code": "goat",
    "character": "🐐",
    "label": "Goat",
    "group": "animals"
  },
  {
    "code": "deer",
    "character": "🦌",
    "label": "Deer",
    "group": "animals"
  },
  {
    "code": "elephant",
    "character": "🐘",
    "label": "Elephant",
    "group": "animals"
  },
  {
    "code": "giraffe",
    "character": "🦒",
    "label": "Giraffe",
    "group": "animals"
  },
  {
    "code": "zebra",
    "character": "🦓",
    "label": "Zebra",
    "group": "animals"
  },
  {
    "code": "camel",
    "character": "🐪",
    "label": "Camel",
    "group": "animals"
  },
  {
    "code": "llama",
    "character": "🦙",
    "label": "Llama",
    "group": "animals"
  },
  {
    "code": "mouse",
    "character": "🐁",
    "label": "Mouse",
    "group": "animals"
  },
  {
    "code": "turtle",
    "character": "🐢",
    "label": "Turtle",
    "group": "animals"
  },
  {
    "code": "fish",
    "character": "🐟",
    "label": "Fish",
    "group": "animals"
  },
  {
    "code": "tropical_fish",
    "character": "🐠",
    "label": "Tropical Fish",
    "group": "animals"
  },
  {
    "code": "blowfish",
    "character": "🐡",
    "label": "Blowfish",
    "group": "animals"
  },
  {
    "code": "dolphin",
    "character": "🐬",
    "label": "Dolphin",
    "group": "animals"
  },
  {
    "code": "whale",
    "character": "🐋",
    "label": "Whale",
    "group": "animals"
  },
  {
    "code": "octopus",
    "character": "🐙",
    "label": "Octopus",
    "group": "animals"
  },
  {
    "code": "shrimp",
    "character": "🦐",
    "label": "Shrimp",
    "group": "animals"
  },
  {
    "code": "crab",
    "character": "🦀",
    "label": "Crab",
    "group": "animals"
  },
  {
    "code": "lobster",
    "character": "🦞",
    "label": "Lobster",
    "group": "animals"
  },
  {
    "code": "squid",
    "character": "🦑",
    "label": "Squid",
    "group": "animals"
  },
  {
    "code": "t_rex",
    "character": "🦖",
    "label": "T-Rex",
    "group": "animals"
  },
  {
    "code": "sauropod",
    "character": "🦕",
    "label": "Sauropod",
    "group": "animals"
  },
  {
    "code": "lizard",
    "character": "🦎",
    "label": "Lizard",
    "group": "animals"
  },
  {
    "code": "bat",
    "character": "🦇",
    "label": "Bat",
    "group": "animals"
  },
  {
    "code": "wolf",
    "character": "🐺",
    "label": "Wolf",
    "group": "animals"
  },
  {
    "code": "boar",
    "character": "🐗",
    "label": "Boar",
    "group": "animals"
  },
  {
    "code": "red_apple",
    "character": "🍎",
    "label": "Apple",
    "group": "food"
  },
  {
    "code": "green_apple",
    "character": "🍏",
    "label": "Green Apple",
    "group": "food"
  },
  {
    "code": "pear",
    "character": "🍐",
    "label": "Pear",
    "group": "food"
  },
  {
    "code": "banana",
    "character": "🍌",
    "label": "Banana",
    "group": "food"
  },
  {
    "code": "grapes",
    "character": "🍇",
    "label": "Grapes",
    "group": "food"
  },
  {
    "code": "watermelon",
    "character": "🍉",
    "label": "Watermelon",
    "group": "food"
  },
  {
    "code": "strawberry",
    "character": "🍓",
    "label": "Strawberry",
    "group": "food"
  },
  {
    "code": "cherries",
    "character": "🍒",
    "label": "Cherries",
    "group": "food"
  },
  {
    "code": "peach",
    "character": "🍑",
    "label": "Peach",
    "group": "food"
  },
  {
    "code": "mango",
    "character": "🥭",
    "label": "Mango",
    "group": "food"
  },
  {
    "code": "lemon",
    "character": "🍋",
    "label": "Lemon",
    "group": "food"
  },
  {
    "code": "orange",
    "character": "🍊",
    "label": "Orange",
    "group": "food"
  },
  {
    "code": "kiwi",
    "character": "🥝",
    "label": "Kiwi",
    "group": "food"
  },
  {
    "code": "blueberries",
    "character": "🫐",
    "label": "Blueberries",
    "group": "food"
  },
  {
    "code": "pineapple",
    "character": "🍍",
    "label": "Pineapple",
    "group": "food"
  },
  {
    "code": "coconut",
    "character": "🥥",
    "label": "Coconut",
    "group": "food"
  },
  {
    "code": "avocado",
    "character": "🥑",
    "label": "Avocado",
    "group": "food"
  },
  {
    "code": "tomato",
    "character": "🍅",
    "label": "Tomato",
    "group": "food"
  },
  {
    "code": "corn",
    "character": "🌽",
    "label": "Corn",
    "group": "food"
  },
  {
    "code": "hot_pepper",
    "character": "🌶️",
    "label": "Hot Pepper",
    "group": "food"
  },
  {
    "code": "bell_pepper",
    "character": "🫑",
    "label": "Bell Pepper",
    "group": "food"
  },
  {
    "code": "cucumber",
    "character": "🥒",
    "label": "Cucumber",
    "group": "food"
  },
  {
    "code": "broccoli",
    "character": "🥦",
    "label": "Broccoli",
    "group": "food"
  },
  {
    "code": "leafy_green",
    "character": "🥬",
    "label": "Leafy Green",
    "group": "food"
  },
  {
    "code": "mushroom",
    "character": "🍄",
    "label": "Mushroom",
    "group": "food"
  },
  {
    "code": "carrot",
    "character": "🥕",
    "label": "Carrot",
    "group": "food"
  },
  {
    "code": "bread",
    "character": "🍞",
    "label": "Bread",
    "group": "food"
  },
  {
    "code": "croissant",
    "character": "🥐",
    "label": "Croissant",
    "group": "food"
  },
  {
    "code": "baguette",
    "character": "🥖",
    "label": "Baguette",
    "group": "food"
  },
  {
    "code": "bagel",
    "character": "🥯",
    "label": "Bagel",
    "group": "food"
  },
  {
    "code": "pretzel",
    "character": "🥨",
    "label": "Pretzel",
    "group": "food"
  },
  {
    "code": "pancakes",
    "character": "🥞",
    "label": "Pancakes",
    "group": "food"
  },
  {
    "code": "waffle",
    "character": "🧇",
    "label": "Waffle",
    "group": "food"
  },
  {
    "code": "cheese",
    "character": "🧀",
    "label": "Cheese",
    "group": "food"
  },
  {
    "code": "egg",
    "character": "🥚",
    "label": "Egg",
    "group": "food"
  },
  {
    "code": "cooking",
    "character": "🍳",
    "label": "Cooking",
    "group": "food"
  },
  {
    "code": "bacon",
    "character": "🥓",
    "label": "Bacon",
    "group": "food"
  },
  {
    "code": "hot_dog",
    "character": "🌭",
    "label": "Hot Dog",
    "group": "food"
  },
  {
    "code": "hamburger",
    "character": "🍔",
    "label": "Burger",
    "group": "food"
  },
  {
    "code": "fries",
    "character": "🍟",
    "label": "Fries",
    "group": "food"
  },
  {
    "code": "pizza",
    "character": "🍕",
    "label": "Pizza",
    "group": "food"
  },
  {
    "code": "taco",
    "character": "🌮",
    "label": "Taco",
    "group": "food"
  },
  {
    "code": "burrito",
    "character": "🌯",
    "label": "Burrito",
    "group": "food"
  },
  {
    "code": "sandwich",
    "character": "🥪",
    "label": "Sandwich",
    "group": "food"
  },
  {
    "code": "falafel",
    "character": "🧆",
    "label": "Falafel",
    "group": "food"
  },
  {
    "code": "stuffed_flatbread",
    "character": "🥙",
    "label": "Stuffed Flatbread",
    "group": "food"
  },
  {
    "code": "salad",
    "character": "🥗",
    "label": "Salad",
    "group": "food"
  },
  {
    "code": "popcorn",
    "character": "🍿",
    "label": "Popcorn",
    "group": "food"
  },
  {
    "code": "ramen",
    "character": "🍜",
    "label": "Ramen",
    "group": "food"
  },
  {
    "code": "spaghetti",
    "character": "🍝",
    "label": "Pasta",
    "group": "food"
  },
  {
    "code": "stew",
    "character": "🍲",
    "label": "Stew",
    "group": "food"
  },
  {
    "code": "curry_rice",
    "character": "🍛",
    "label": "Curry",
    "group": "food"
  },
  {
    "code": "sushi",
    "character": "🍣",
    "label": "Sushi",
    "group": "food"
  },
  {
    "code": "rice_ball",
    "character": "🍙",
    "label": "Rice Ball",
    "group": "food"
  },
  {
    "code": "rice",
    "character": "🍚",
    "label": "Rice",
    "group": "food"
  },
  {
    "code": "cake",
    "character": "🎂",
    "label": "Cake",
    "group": "food"
  },
  {
    "code": "cupcake",
    "character": "🧁",
    "label": "Cupcake",
    "group": "food"
  },
  {
    "code": "shortcake",
    "character": "🍰",
    "label": "Shortcake",
    "group": "food"
  },
  {
    "code": "cookie",
    "character": "🍪",
    "label": "Cookie",
    "group": "food"
  },
  {
    "code": "chocolate",
    "character": "🍫",
    "label": "Chocolate",
    "group": "food"
  },
  {
    "code": "candy",
    "character": "🍬",
    "label": "Candy",
    "group": "food"
  },
  {
    "code": "lollipop",
    "character": "🍭",
    "label": "Lollipop",
    "group": "food"
  },
  {
    "code": "ice_cream",
    "character": "🍨",
    "label": "Ice Cream",
    "group": "food"
  },
  {
    "code": "soft_ice_cream",
    "character": "🍦",
    "label": "Soft Ice Cream",
    "group": "food"
  },
  {
    "code": "honey",
    "character": "🍯",
    "label": "Honey",
    "group": "food"
  },
  {
    "code": "coffee",
    "character": "☕",
    "label": "Coffee",
    "group": "food"
  },
  {
    "code": "tea",
    "character": "🍵",
    "label": "Tea",
    "group": "food"
  },
  {
    "code": "juice",
    "character": "🧃",
    "label": "Juice",
    "group": "food"
  },
  {
    "code": "clinking_glasses",
    "character": "🥂",
    "label": "Cheers",
    "group": "food"
  },
  {
    "code": "wine_glass",
    "character": "🍷",
    "label": "Wine",
    "group": "food"
  },
  {
    "code": "cocktail",
    "character": "🍸",
    "label": "Cocktail",
    "group": "food"
  },
  {
    "code": "champagne",
    "character": "🍾",
    "label": "Champagne",
    "group": "food"
  },
  {
    "code": "beer",
    "character": "🍺",
    "label": "Beer",
    "group": "food"
  },
  {
    "code": "clinking_beer_mugs",
    "character": "🍻",
    "label": "Cheers Beer",
    "group": "food"
  },
  {
    "code": "tropical_drink",
    "character": "🍹",
    "label": "Tropical Drink",
    "group": "food"
  },
  {
    "code": "cup_with_straw",
    "character": "🥤",
    "label": "Cup with Straw",
    "group": "food"
  },
  {
    "code": "fire",
    "character": "🔥",
    "label": "Fire",
    "group": "misc"
  },
  {
    "code": "party",
    "character": "🎉",
    "label": "Party",
    "group": "misc"
  },
  {
    "code": "confetti",
    "character": "🎊",
    "label": "Confetti",
    "group": "misc"
  },
  {
    "code": "balloon",
    "character": "🎈",
    "label": "Balloon",
    "group": "misc"
  },
  {
    "code": "ribbon",
    "character": "🎀",
    "label": "Ribbon",
    "group": "misc"
  },
  {
    "code": "gift",
    "character": "🎁",
    "label": "Gift",
    "group": "misc"
  },
  {
    "code": "fireworks",
    "character": "🎆",
    "label": "Fireworks",
    "group": "misc"
  },
  {
    "code": "sparkler",
    "character": "🎇",
    "label": "Sparkler",
    "group": "misc"
  },
  {
    "code": "trophy",
    "character": "🏆",
    "label": "Trophy",
    "group": "misc"
  },
  {
    "code": "medal",
    "character": "🏅",
    "label": "Medal",
    "group": "misc"
  },
  {
    "code": "first_place",
    "character": "🥇",
    "label": "First Place",
    "group": "misc"
  },
  {
    "code": "second_place",
    "character": "🥈",
    "label": "Second Place",
    "group": "misc"
  },
  {
    "code": "third_place",
    "character": "🥉",
    "label": "Third Place",
    "group": "misc"
  },
  {
    "code": "crown",
    "character": "👑",
    "label": "Crown",
    "group": "misc"
  },
  {
    "code": "gem",
    "character": "💎",
    "label": "Gem",
    "group": "misc"
  },
  {
    "code": "hundred",
    "character": "💯",
    "label": "Perfect",
    "group": "misc"
  },
  {
    "code": "check",
    "character": "✅",
    "label": "Check",
    "group": "misc"
  },
  {
    "code": "bullseye",
    "character": "🎯",
    "label": "Bullseye",
    "group": "misc"
  },
  {
    "code": "musical_note",
    "character": "🎵",
    "label": "Music",
    "group": "misc"
  },
  {
    "code": "musical_notes",
    "character": "🎶",
    "label": "Music Notes",
    "group": "misc"
  },
  {
    "code": "microphone",
    "character": "🎤",
    "label": "Mic",
    "group": "misc"
  },
  {
    "code": "headphone",
    "character": "🎧",
    "label": "Headphone",
    "group": "misc"
  },
  {
    "code": "art",
    "character": "🎨",
    "label": "Art",
    "group": "misc"
  },
  {
    "code": "camera",
    "character": "📷",
    "label": "Camera",
    "group": "misc"
  },
  {
    "code": "book",
    "character": "📖",
    "label": "Book",
    "group": "misc"
  },
  {
    "code": "pencil",
    "character": "✏️",
    "label": "Write",
    "group": "misc"
  },
  {
    "code": "lightbulb",
    "character": "💡",
    "label": "Lightbulb",
    "group": "misc"
  },
  {
    "code": "key",
    "character": "🔑",
    "label": "Key",
    "group": "misc"
  },
  {
    "code": "lock",
    "character": "🔒",
    "label": "Lock",
    "group": "misc"
  },
  {
    "code": "unlock",
    "character": "🔓",
    "label": "Unlock",
    "group": "misc"
  },
  {
    "code": "envelope",
    "character": "✉️",
    "label": "Envelope",
    "group": "misc"
  },
  {
    "code": "telephone",
    "character": "☎️",
    "label": "Phone",
    "group": "misc"
  },
  {
    "code": "computer",
    "character": "💻",
    "label": "Computer",
    "group": "misc"
  },
  {
    "code": "game_die",
    "character": "🎲",
    "label": "Game Die",
    "group": "misc"
  },
  {
    "code": "circus_tent",
    "character": "🎪",
    "label": "Circus",
    "group": "misc"
  },
  {
    "code": "performing_arts",
    "character": "🎭",
    "label": "Performing Arts",
    "group": "misc"
  },
  {
    "code": "house",
    "character": "🏠",
    "label": "House",
    "group": "misc"
  },
  {
    "code": "house_with_garden",
    "character": "🏡",
    "label": "House with Garden",
    "group": "misc"
  },
  {
    "code": "love_hotel",
    "character": "🏩",
    "label": "Love Hotel",
    "group": "misc"
  },
  {
    "code": "castle",
    "character": "🏰",
    "label": "Castle",
    "group": "misc"
  },
  {
    "code": "stadium",
    "character": "🏟️",
    "label": "Stadium",
    "group": "misc"
  },
  {
    "code": "ferris_wheel",
    "character": "🎡",
    "label": "Ferris Wheel",
    "group": "misc"
  },
  {
    "code": "carousel",
    "character": "🎠",
    "label": "Carousel",
    "group": "misc"
  },
  {
    "code": "roller_coaster",
    "character": "🎢",
    "label": "Roller Coaster",
    "group": "misc"
  },
  {
    "code": "fountain",
    "character": "⛲",
    "label": "Fountain",
    "group": "misc"
  },
  {
    "code": "umbrella",
    "character": "⛱️",
    "label": "Umbrella",
    "group": "misc"
  },
  {
    "code": "soccer",
    "character": "⚽",
    "label": "Soccer",
    "group": "misc"
  },
  {
    "code": "basketball",
    "character": "🏀",
    "label": "Basketball",
    "group": "misc"
  },
  {
    "code": "football",
    "character": "🏈",
    "label": "Football",
    "group": "misc"
  },
  {
    "code": "baseball",
    "character": "⚾",
    "label": "Baseball",
    "group": "misc"
  },
  {
    "code": "tennis",
    "character": "🎾",
    "label": "Tennis",
    "group": "misc"
  },
  {
    "code": "volleyball",
    "character": "🏐",
    "label": "Volleyball",
    "group": "misc"
  },
  {
    "code": "pool_8_ball",
    "character": "🎱",
    "label": "8 Ball",
    "group": "misc"
  },
  {
    "code": "bowling",
    "character": "🎳",
    "label": "Bowling",
    "group": "misc"
  }
];

export const POPULAR_BY_GROUP: Record<string, string[]> = {
  "heart": [
    "heart",
    "red_heart",
    "sparkling_heart",
    "two_hearts",
    "growing_heart",
    "heartbeat"
  ],
  "face": [
    "touched",
    "blush",
    "grinning",
    "heart_eyes",
    "partying_face",
    "joy"
  ],
  "hands": [
    "grateful",
    "heart_hands",
    "clap",
    "muscle",
    "thumbs_up",
    "praise"
  ],
  "nature": [
    "sun",
    "rainbow",
    "sparkles",
    "cherry_blossom",
    "sunflower",
    "star"
  ],
  "animals": [
    "dog_face",
    "cat_face",
    "panda_face",
    "penguin",
    "fox_face",
    "unicorn_face"
  ],
  "food": [
    "cake",
    "coffee",
    "pizza",
    "strawberry",
    "champagne",
    "clinking_glasses"
  ],
  "misc": [
    "fire",
    "hundred",
    "party",
    "trophy",
    "check",
    "balloon"
  ]
};

export const LEGACY_MAPPINGS: Record<string, string> = {
  "pray": "grateful",
  "smiling_face_with_heart_eyes": "heart_eyes",
  "happy": "blush",
  "raised_hands": "praise",
  "warm_hug": "hug",
  "default": "thumbs_up"
};

export const VALID_GROUPS = ['heart', 'face', 'hands', 'misc', 'nature', 'animals', 'food'] as const;
export type ReactionGroup = typeof VALID_GROUPS[number];

const inventoryByCode = new Map(REACTION_INVENTORY.map(item => [item.code, item]));

export function getReactionByCode(code: string): ReactionItem | undefined {
  return inventoryByCode.get(code) || inventoryByCode.get(LEGACY_MAPPINGS[code] || '');
}

export function getEmojiFromCode(code: string): string {
  const reaction = getReactionByCode(code);
  return reaction?.character || '👍';
}

export function getAvailableEmojis(): { code: string; emoji: string; label: string }[] {
  return REACTION_INVENTORY.map(item => ({ code: item.code, emoji: item.character, label: item.label }));
}

export function getTopEmojis(emojiCounts: Record<string, number>, limit: number = 3): { code: string; count: number }[] {
  if (!emojiCounts) return [];
  return Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, count]) => ({ code, count }));
}

/**
 * Composes a compact row of exact length `slots`.
 * Prioritizes recent items, removes duplicates, and backfills with popular items.
 */
export function composeCompactRow(recentList: string[], popularList: string[], slots: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const code of recentList) {
    if (!seen.has(code) && inventoryByCode.has(code)) {
      result.push(code);
      seen.add(code);
      if (result.length === slots) return result;
    }
  }

  for (const code of popularList) {
    if (!seen.has(code) && inventoryByCode.has(code)) {
      result.push(code);
      seen.add(code);
      if (result.length === slots) return result;
    }
  }

  return result;
}
