from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, field_validator

def to_camel(string: str) -> str:
    return ''.join(word.capitalize() if i > 0 else word for i, word in enumerate(string.split('_')))

class AuthorResponse(BaseModel):
    """Unified response model for user author/actor data with consistent camelCase serialization."""
    id: str
    username: str
    display_name: Optional[str] = None
    name: str
    image: Optional[str] = None
    follower_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    is_following: Optional[bool] = None

    @field_validator('id', mode='before')
    @classmethod
    def ensure_id_is_str(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel
    )
