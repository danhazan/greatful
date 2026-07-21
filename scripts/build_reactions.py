#!/usr/bin/env python3
"""Build shared/reactions.json from curated emoji categories.

Strategy: Start broad from text-emoji-picker categories, remove only clearly
negative/aggressive/violent/disturbing entries. Lenient positive filter.
"""

import json

# Each emoji: (code, character, label)
# Codes are snake_case based on the emoji name

HEART = [
    ("heart", "💜", "Heart"),
    ("red_heart", "❤️", "Red Heart"),
    ("orange_heart", "🧡", "Orange Heart"),
    ("yellow_heart", "💛", "Yellow Heart"),
    ("green_heart", "💚", "Green Heart"),
    ("blue_heart", "💙", "Blue Heart"),
    ("purple_heart", "💜", "Purple Heart"),
    ("brown_heart", "🤎", "Brown Heart"),
    ("black_heart", "🖤", "Black Heart"),
    ("white_heart", "🤍", "White Heart"),
    ("sparkling_heart", "💖", "Sparkling"),
    ("two_hearts", "💕", "Two Hearts"),
    ("revolving_hearts", "💞", "Revolving Hearts"),
    ("heartbeat", "💓", "Heartbeat"),
    ("growing_heart", "💗", "Growing Heart"),
    ("heart_on_fire", "❤️‍🔥", "Heart on Fire"),
    ("cupid", "💘", "Cupid"),
    ("gift_heart", "💝", "Gift Heart"),
    ("heart_decoration", "💟", "Heart Decoration"),
    ("heart_exclamation", "❣️", "Heart Exclamation"),
    ("love_letter", "💌", "Love Letter"),
    ("kiss_mark", "💋", "Kiss Mark"),
    ("lips", "👄", "Lips"),
    ("ring", "💍", "Ring"),
]

FACE = [
    # Joy & laughter
    ("grinning", "😀", "Grinning"),
    ("smiley", "😃", "Smiley"),
    ("smile", "😄", "Smile"),
    ("beaming", "😁", "Beaming"),
    ("laughing", "😆", "Laughing"),
    ("sweat_smile", "😅", "Relieved"),
    ("joy", "😂", "Joy"),
    ("rolling_on_floor", "🤣", "ROFL"),
    # Friendly
    ("slightly_smiling", "🙂", "Smile"),
    ("upside_down", "🙃", "Silly"),
    ("wink", "😉", "Wink"),
    ("blush", "😊", "Blush"),
    ("innocent", "😇", "Innocent"),
    # Love faces
    ("heart_eyes", "😍", "Love it"),
    ("heart_face", "🥰", "Adore"),
    ("starstruck", "🤩", "Starstruck"),
    # Kissing
    ("kissing_heart", "😘", "Kissing Heart"),
    ("kissing", "😗", "Kissing"),
    ("warm_smile", "☺️", "Warm Smile"),
    ("kissing_closed_eyes", "😚", "Kissing Eyes Closed"),
    ("kissing_smiling_eyes", "😙", "Kissing Smile"),
    # Touched
    ("touched", "🥹", "Grateful"),
    ("holding_back_tears", "🥲", "Touched"),
    # Playful/tongue
    ("yum", "😋", "Yum"),
    ("stuck_out_tongue", "😛", "Tongue Out"),
    ("stuck_out_tongue_winking_eye", "😜", "Playful"),
    ("zany_face", "🤪", "Zany"),
    ("stuck_out_tongue_closed_eyes", "😝", "Silly"),
    # Hug/gesture
    ("hug", "🤗", "Hug"),
    ("face_with_hand", "🤭", "Oops"),
    ("shushing_face", "🤫", "Shush"),
    ("thinking", "🤔", "Thinking"),
    # Neutral/expressive
    ("face_with_raised_eyebrow", "🤨", "Suspicious"),
    ("neutral_face", "😐", "Neutral"),
    ("expressionless", "😑", "Expressionless"),
    ("face_without_mouth", "😶", "Silent"),
    ("smirk", "😏", "Smirk"),
    ("unamused", "😒", "Unamused"),
    ("face_with_rolling_eyes", "🙄", "Eye Roll"),
    ("grimacing", "😬", "Grimace"),
    ("relieved", "😌", "Relieved"),
    ("pensive", "😔", "Pensive"),
    ("sleepy", "😪", "Sleepy"),
    ("drooling", "🤤", "Drooling"),
    ("sleeping", "😴", "Sleeping"),
    ("dizzy_face", "😵", "Dizzy"),
    ("mind_blown", "🤯", "Mind Blown"),
    # Surprised/expressive
    ("flushed", "😳", "Flushed"),
    ("pleading", "🥺", "Pleading"),
    ("partying_face", "🥳", "Celebrate"),
    ("cool", "😎", "Cool"),
    ("nerd_face", "🤓", "Nerd"),
    ("face_with_monocle", "🧐", "Curious"),
    ("cowboy_hat_face", "🤠", "Cowboy"),
    ("salute", "🫡", "Salute"),
    ("hugging_people", "🫂", "Hugging"),
    # Surprise
    ("face_with_open_mouth", "😮", "Surprised"),
    ("hushed", "😯", "Hushed"),
    ("astonished", "😲", "Astonished"),
    ("crying", "😢", "Crying"),
    ("loudly_crying", "😭", "Sobbing"),
    ("woozy_face", "🥴", "Woozy"),
    ("confused_face", "😕", "Confused"),
    ("zipper_mouth_face", "🤐", "Zipper Mouth"),
    ("hot_face", "🥵", "Hot"),
    ("cold_face", "🥶", "Cold"),
    # Person emojis (neutral/positive)
    ("baby", "👶", "Baby"),
    ("child", "🧒", "Child"),
    ("boy", "👦", "Boy"),
    ("girl", "👧", "Girl"),
    ("adult", "🧑", "Adult"),
    ("older_adult", "🧓", "Older Adult"),
    ("man", "👨", "Man"),
    ("woman", "👩", "Woman"),
    ("person_blond_hair", "👱", "Blond"),
    ("bearded_person", "🧔", "Bearded"),
    ("man_red_hair", "👨‍🦰", "Man Red Hair"),
    ("man_curly_hair", "👨‍🦱", "Man Curly Hair"),
    ("man_white_hair", "👨‍🦳", "Man White Hair"),
    ("man_bald", "👨‍🦲", "Man Bald"),
    ("woman_red_hair", "👩‍🦰", "Woman Red Hair"),
    ("woman_curly_hair", "👩‍🦱", "Woman Curly Hair"),
    ("woman_white_hair", "👩‍🦳", "Woman White Hair"),
    ("woman_bald", "👩‍🦲", "Woman Bald"),
]

HANDS = [
    ("thumbs_up", "👍", "Thumbs Up"),
    ("ok_hand", "👌", "OK"),
    ("pinched_fingers", "🤌", "Pinched"),
    ("pinching_hand", "🤏", "Pinching"),
    ("peace", "✌️", "Peace"),
    ("crossed_fingers", "🤞", "Fingers Crossed"),
    ("love_you_gesture", "🤟", "Love You"),
    ("sign_of_the_horns", "🤘", "Rock On"),
    ("call_me", "🤙", "Call Me"),
    ("index_pointing_up", "☝️", "Pointing Up"),
    ("backhand_index_pointing_up", "👆", "Point Up"),
    ("backhand_index_pointing_down", "👇", "Point Down"),
    ("backhand_index_pointing_left", "👈", "Point Left"),
    ("backhand_index_pointing_right", "👉", "Point Right"),
    ("wave", "👋", "Wave"),
    ("raised_back_of_hand", "🖐️", "Raised Hand"),
    ("raised_hand", "✋", "Raised Hand"),
    ("vulcan_salute", "🖖", "Salute"),
    ("clap", "👏", "Applause"),
    ("praise", "🙌", "Praise"),
    ("palms_up_together", "🤲", "Palms Up"),
    ("handshake", "🤝", "Handshake"),
    ("grateful", "🙏", "Thankful"),
    ("writing_hand", "✍️", "Writing"),
    ("nail_polish", "💅", "Nail Polish"),
    ("selfie", "🤳", "Selfie"),
    ("muscle", "💪", "Strong"),
    ("heart_hands", "🫶", "Heart Hands"),
    ("open_hands", "👐", "Open Hands"),
    ("left_facing_fist", "🤛", "Fist Bump"),
    ("right_facing_fist", "🤜", "Fist Bump"),
]

NATURE = [
    # Sun / moon / sky
    ("sun", "☀️", "Sunshine"),
    ("sun_with_face", "🌞", "Sun with Face"),
    ("full_moon", "🌝", "Full Moon"),
    ("new_moon", "🌑", "New Moon"),
    ("waxing_crescent_moon", "🌒", "Waxing Crescent"),
    ("first_quarter_moon", "🌓", "First Quarter"),
    ("waxing_gibbous_moon", "🌔", "Waxing Gibbous"),
    ("waning_gibbous_moon", "🌖", "Waning Gibbous"),
    ("last_quarter_moon", "🌗", "Last Quarter"),
    ("waning_crescent_moon", "🌘", "Waning Crescent"),
    ("crescent_moon", "🌙", "Crescent Moon"),
    ("new_moon_face", "🌚", "New Moon Face"),
    # full_moon_face uses same character as full_moon, skipped
    ("last_quarter_moon_face", "🌛", "Last Quarter Face"),
    ("first_quarter_moon_face", "🌜", "First Quarter Face"),
    ("star", "⭐", "Star"),
    ("glowing_star", "🌟", "Glowing Star"),
    ("dizzy", "💫", "Dizzy"),
    ("sparkles", "✨", "Sparkles"),
    ("rainbow", "🌈", "Rainbow"),
    # Weather
    ("cloud", "☁️", "Cloud"),
    ("sun_behind_cloud", "⛅", "Sun Behind Cloud"),
    ("sun_behind_small_cloud", "🌤️", "Sun Behind Small Cloud"),
    ("sun_behind_large_cloud", "🌥️", "Sun Behind Large Cloud"),
    ("snowflake", "❄️", "Snowflake"),
    ("droplet", "💧", "Droplet"),
    ("water_wave", "🌊", "Wave"),
    ("wind", "💨", "Wind"),
    # Earth
    ("earth_americas", "🌎", "Earth"),
    ("earth_africa", "🌍", "Earth Africa"),
    ("earth_asia", "🌏", "Earth Asia"),
    # Plants
    ("seedling", "🌱", "Seedling"),
    ("herb", "🌿", "Herb"),
    ("leaf", "🍃", "Leaf"),
    ("fallen_leaf", "🍂", "Fallen Leaf"),
    ("maple_leaf", "🍁", "Maple Leaf"),
    ("evergreen_tree", "🌲", "Evergreen"),
    ("deciduous_tree", "🌳", "Tree"),
    ("palm_tree", "🌴", "Palm Tree"),
    ("cactus", "🌵", "Cactus"),
    ("sheaf_of_rice", "🌾", "Rice"),
    # Flowers
    ("sunflower", "🌻", "Sunflower"),
    ("rose", "🌹", "Rose"),
    ("wilted_flower", "🥀", "Wilted Flower"),
    ("hibiscus", "🌺", "Hibiscus"),
    ("cherry_blossom", "🌸", "Cherry Blossom"),
    ("tulip", "🌷", "Tulip"),
    ("blossom", "🌼", "Blossom"),
    ("lotus", "🪷", "Lotus"),
    ("four_leaf_clover", "🍀", "Lucky"),
    ("bouquet", "💐", "Bouquet"),
    ("butterfly", "🦋", "Butterfly"),
    # Landscapes
    ("mountain", "⛰️", "Mountain"),
    ("snow_capped_mountain", "🏔️", "Snow Mountain"),
    ("volcano", "🌋", "Volcano"),
    ("mount_fuji", "🗻", "Mount Fuji"),
    ("camping", "🏕️", "Camping"),
    ("beach", "🏖️", "Beach"),
    ("desert", "🏜️", "Desert"),
    ("island", "🏝️", "Island"),
    ("sunrise", "🌅", "Sunrise"),
    ("sunset", "🌇", "Sunset"),
    ("city_sunset", "🌆", "City Sunset"),
    ("city_night", "🌃", "Night Sky"),
    ("night_with_stars", "🌌", "Milky Way"),
    ("hot_springs", "♨️", "Hot Springs"),
    ("national_park", "🏞️", "National Park"),
]

ANIMALS = [
    # Animal faces
    ("dog_face", "🐶", "Dog"),
    ("cat_face", "🐱", "Cat"),
    ("mouse_face", "🐭", "Mouse"),
    ("hamster", "🐹", "Hamster"),
    ("rabbit_face", "🐰", "Rabbit"),
    ("fox_face", "🦊", "Fox"),
    ("bear_face", "🐻", "Bear"),
    ("polar_bear", "🐻‍❄️", "Polar Bear"),
    ("panda_face", "🐼", "Panda"),
    ("koala", "🐨", "Koala"),
    ("tiger_face", "🐯", "Tiger"),
    ("lion_face", "🦁", "Lion"),
    ("cow_face", "🐮", "Cow"),
    ("pig_face", "🐷", "Pig"),
    ("pig_nose", "🐽", "Pig Nose"),
    ("frog", "🐸", "Frog"),
    ("horse_face", "🐴", "Horse"),
    ("unicorn_face", "🦄", "Unicorn"),
    # Monkeys
    ("monkey_face", "🐵", "Monkey"),
    ("see_no_evil", "🙈", "See No Evil"),
    ("hear_no_evil", "🙉", "Hear No Evil"),
    ("speak_no_evil", "🙊", "Speak No Evil"),
    ("monkey", "🐒", "Monkey"),
    # Birds
    ("chicken_face", "🐔", "Chicken"),
    ("penguin", "🐧", "Penguin"),
    ("bird", "🐦", "Bird"),
    ("chick", "🐤", "Chick"),
    ("hatching_chick", "🐣", "Hatching"),
    ("baby_chick", "🐥", "Baby Chick"),
    ("duck", "🦆", "Duck"),
    ("eagle", "🦅", "Eagle"),
    ("owl", "🦉", "Owl"),
    ("dove", "🕊️", "Peace"),
    # Mammals
    ("dog", "🐕", "Dog"),
    ("cat", "🐈", "Cat"),
    ("rabbit", "🐇", "Rabbit"),
    ("raccoon", "🦝", "Raccoon"),
    ("hedgehog", "🦔", "Hedgehog"),
    ("squirrel", "🐿️", "Squirrel"),
    ("horse", "🐎", "Horse"),
    ("cow", "🐄", "Cow"),
    ("pig", "🐖", "Pig"),
    ("sheep", "🐑", "Sheep"),
    ("goat", "🐐", "Goat"),
    ("deer", "🦌", "Deer"),
    ("elephant", "🐘", "Elephant"),
    ("giraffe", "🦒", "Giraffe"),
    ("zebra", "🦓", "Zebra"),
    ("camel", "🐪", "Camel"),
    ("llama", "🦙", "Llama"),
    ("mouse", "🐁", "Mouse"),
    # Sea creatures
    ("turtle", "🐢", "Turtle"),
    ("fish", "🐟", "Fish"),
    ("tropical_fish", "🐠", "Tropical Fish"),
    ("blowfish", "🐡", "Blowfish"),
    ("dolphin", "🐬", "Dolphin"),
    ("whale", "🐋", "Whale"),
    ("octopus", "🐙", "Octopus"),
    ("shrimp", "🦐", "Shrimp"),
    ("crab", "🦀", "Crab"),
    ("lobster", "🦞", "Lobster"),
    ("squid", "🦑", "Squid"),
    # Dinosaurs
    ("t_rex", "🦖", "T-Rex"),
    ("sauropod", "🦕", "Sauropod"),
    # Insects (pleasant only)
    ("bee", "🐝", "Bee"),
    ("ladybug", "🐞", "Ladybug"),
    ("snail", "🐌", "Snail"),
    # Reptiles (friendly)
    ("lizard", "🦎", "Lizard"),
    # Other
    ("bat", "🦇", "Bat"),
    ("wolf", "🐺", "Wolf"),
    ("boar", "🐗", "Boar"),
]

FOOD = [
    # Fruits
    ("red_apple", "🍎", "Apple"),
    ("green_apple", "🍏", "Green Apple"),
    ("pear", "🍐", "Pear"),
    ("banana", "🍌", "Banana"),
    ("grapes", "🍇", "Grapes"),
    ("watermelon", "🍉", "Watermelon"),
    ("strawberry", "🍓", "Strawberry"),
    ("cherries", "🍒", "Cherries"),
    ("peach", "🍑", "Peach"),
    ("mango", "🥭", "Mango"),
    ("lemon", "🍋", "Lemon"),
    ("orange", "🍊", "Orange"),
    ("kiwi", "🥝", "Kiwi"),
    ("blueberries", "🫐", "Blueberries"),
    ("pineapple", "🍍", "Pineapple"),
    ("coconut", "🥥", "Coconut"),
    ("avocado", "🥑", "Avocado"),
    ("tomato", "🍅", "Tomato"),
    # Vegetables
    ("corn", "🌽", "Corn"),
    ("hot_pepper", "🌶️", "Hot Pepper"),
    ("bell_pepper", "🫑", "Bell Pepper"),
    ("cucumber", "🥒", "Cucumber"),
    ("broccoli", "🥦", "Broccoli"),
    ("leafy_green", "🥬", "Leafy Green"),
    ("mushroom", "🍄", "Mushroom"),
    ("carrot", "🥕", "Carrot"),
    # Bread & baked goods
    ("bread", "🍞", "Bread"),
    ("croissant", "🥐", "Croissant"),
    ("baguette", "🥖", "Baguette"),
    ("bagel", "🥯", "Bagel"),
    ("pretzel", "🥨", "Pretzel"),
    ("pancakes", "🥞", "Pancakes"),
    ("waffle", "🧇", "Waffle"),
    # Cheese & eggs
    ("cheese", "🧀", "Cheese"),
    ("egg", "🥚", "Egg"),
    ("cooking", "🍳", "Cooking"),
    # Meat (neutral)
    ("bacon", "🥓", "Bacon"),
    ("hot_dog", "🌭", "Hot Dog"),
    ("hamburger", "🍔", "Burger"),
    ("fries", "🍟", "Fries"),
    ("pizza", "🍕", "Pizza"),
    # International
    ("taco", "🌮", "Taco"),
    ("burrito", "🌯", "Burrito"),
    ("sandwich", "🥪", "Sandwich"),
    ("falafel", "🧆", "Falafel"),
    ("stuffed_flatbread", "🥙", "Stuffed Flatbread"),
    ("salad", "🥗", "Salad"),
    ("popcorn", "🍿", "Popcorn"),
    ("ramen", "🍜", "Ramen"),
    ("spaghetti", "🍝", "Pasta"),
    ("stew", "🍲", "Stew"),
    ("curry_rice", "🍛", "Curry"),
    ("sushi", "🍣", "Sushi"),
    ("rice_ball", "🍙", "Rice Ball"),
    ("rice", "🍚", "Rice"),
    # Desserts
    ("cake", "🎂", "Cake"),
    ("cupcake", "🧁", "Cupcake"),
    ("shortcake", "🍰", "Shortcake"),
    ("cookie", "🍪", "Cookie"),
    ("chocolate", "🍫", "Chocolate"),
    ("candy", "🍬", "Candy"),
    ("lollipop", "🍭", "Lollipop"),
    ("ice_cream", "🍨", "Ice Cream"),
    ("soft_ice_cream", "🍦", "Soft Ice Cream"),
    ("honey", "🍯", "Honey"),
    # Drinks
    ("coffee", "☕", "Coffee"),
    ("tea", "🍵", "Tea"),
    ("juice", "🧃", "Juice"),
    ("clinking_glasses", "🥂", "Cheers"),
    ("wine_glass", "🍷", "Wine"),
    ("cocktail", "🍸", "Cocktail"),
    ("champagne", "🍾", "Champagne"),
    ("beer", "🍺", "Beer"),
    ("clinking_beer_mugs", "🍻", "Cheers Beer"),
    ("tropical_drink", "🍹", "Tropical Drink"),
    ("cup_with_straw", "🥤", "Cup with Straw"),
]

MISC = [
    # Celebration
    ("fire", "🔥", "Fire"),
    ("party", "🎉", "Party"),
    ("confetti", "🎊", "Confetti"),
    ("balloon", "🎈", "Balloon"),
    ("ribbon", "🎀", "Ribbon"),
    ("gift", "🎁", "Gift"),
    ("fireworks", "🎆", "Fireworks"),
    ("sparkler", "🎇", "Sparkler"),
    # Awards
    ("trophy", "🏆", "Trophy"),
    ("medal", "🏅", "Medal"),
    ("first_place", "🥇", "First Place"),
    ("second_place", "🥈", "Second Place"),
    ("third_place", "🥉", "Third Place"),
    ("crown", "👑", "Crown"),
    ("gem", "💎", "Gem"),
    # Status
    ("hundred", "💯", "Perfect"),
    ("check", "✅", "Check"),
    ("bullseye", "🎯", "Bullseye"),
    # Music & art
    ("musical_note", "🎵", "Music"),
    ("musical_notes", "🎶", "Music Notes"),
    ("microphone", "🎤", "Mic"),
    ("headphone", "🎧", "Headphone"),
    ("art", "🎨", "Art"),
    ("camera", "📷", "Camera"),
    # Objects
    ("book", "📖", "Book"),
    ("pencil", "✏️", "Write"),
    ("lightbulb", "💡", "Lightbulb"),
    ("key", "🔑", "Key"),
    ("lock", "🔒", "Lock"),
    ("unlock", "🔓", "Unlock"),
    ("envelope", "✉️", "Envelope"),
    ("telephone", "☎️", "Phone"),
    ("computer", "💻", "Computer"),
    ("game_die", "🎲", "Game Die"),
    # Celebration people
    ("circus_tent", "🎪", "Circus"),
    ("performing_arts", "🎭", "Performing Arts"),
    # Travel/House
    ("house", "🏠", "House"),
    ("house_with_garden", "🏡", "House with Garden"),
    ("love_hotel", "🏩", "Love Hotel"),
    ("castle", "🏰", "Castle"),
    ("stadium", "🏟️", "Stadium"),
    ("ferris_wheel", "🎡", "Ferris Wheel"),
    ("carousel", "🎠", "Carousel"),
    ("roller_coaster", "🎢", "Roller Coaster"),
    ("fountain", "⛲", "Fountain"),
    ("umbrella", "⛱️", "Umbrella"),
    # Sports (recreational)
    ("soccer", "⚽", "Soccer"),
    ("basketball", "🏀", "Basketball"),
    ("football", "🏈", "Football"),
    ("baseball", "⚾", "Baseball"),
    ("tennis", "🎾", "Tennis"),
    ("volleyball", "🏐", "Volleyball"),
    ("pool_8_ball", "🎱", "8 Ball"),
    ("bowling", "🎳", "Bowling"),
]

POPULAR = {
    "heart": ["heart", "red_heart", "sparkling_heart", "two_hearts", "growing_heart", "heartbeat"],
    "face": ["touched", "blush", "grinning", "heart_eyes", "partying_face", "joy"],
    "hands": ["grateful", "heart_hands", "clap", "muscle", "thumbs_up", "praise"],
    "nature": ["sun", "rainbow", "sparkles", "cherry_blossom", "sunflower", "star"],
    "animals": ["dog_face", "cat_face", "panda_face", "penguin", "fox_face", "unicorn_face"],
    "food": ["cake", "coffee", "pizza", "strawberry", "champagne", "clinking_glasses"],
    "misc": ["fire", "hundred", "party", "trophy", "check", "balloon"],
}

LEGACY = {
    "pray": "grateful",
    "smiling_face_with_heart_eyes": "heart_eyes",
    "happy": "blush",
    "raised_hands": "praise",
    "warm_hug": "hug",
    "default": "thumbs_up",
}

def write_reactions(groups, output_path):
    inventory = []
    codes = set()
    for group_name, items in groups:
        for code, char, label in items:
            assert code not in codes, f"Duplicate code: {code}"
            codes.add(code)
            inventory.append({"code": code, "character": char, "label": label, "group": group_name})

    data = {
        "inventory": inventory,
        "popular_by_group": POPULAR,
        "legacy_mappings": LEGACY,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Written {len(inventory)} emojis to {output_path}")

    from collections import Counter
    group_counts = Counter(e["group"] for e in inventory)
    for g in sorted(group_counts):
        print(f"  {g}: {group_counts[g]}")
    print(f"  Total: {len(inventory)}")

if __name__ == "__main__":
    import os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output = os.path.join(root, "shared", "reactions.json")
    groups = [
        ("heart", HEART),
        ("face", FACE),
        ("hands", HANDS),
        ("nature", NATURE),
        ("animals", ANIMALS),
        ("food", FOOD),
        ("misc", MISC),
    ]
    write_reactions(groups, output)
