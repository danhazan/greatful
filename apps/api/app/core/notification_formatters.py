def format_reaction_notification(object_type: str = "post") -> tuple[str, str]:
    """Return the title and action text for reaction notifications."""
    normalized_object_type = object_type or "post"

    action_texts = {
        "image": "reacted to an image in your post",
        "comment": "reacted to your comment",
    }
    action = action_texts.get(normalized_object_type, "reacted to your post")
    return "New Reaction", action
