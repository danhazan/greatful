"""
Shared notification formatting helpers.
"""

from app.models.emoji_reaction import EmojiReaction


def format_reaction_notification(
    emoji_code: str,
    object_type: str = "post",
) -> tuple[str, str]:
    """Return the title and action text for reaction notifications."""
    normalized_object_type = object_type or "post"

    if emoji_code == "heart":
        if normalized_object_type == "image":
            return "New Like 💜", "liked an image in your post 💜"
        return "New Like 💜", "liked your post 💜"

    emoji_display = EmojiReaction.VALID_EMOJIS.get(emoji_code, emoji_code)
    if normalized_object_type == "image":
        return "New Reaction", f"reacted to an image in your post with {emoji_display}"
    return "New Reaction", f"reacted to your post with {emoji_display}"
