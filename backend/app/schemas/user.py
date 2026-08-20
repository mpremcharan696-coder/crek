"""User profile and settings schemas for Pilotly."""

from datetime import datetime

from pydantic import BaseModel


class UserProfile(BaseModel):
    """Full user profile response schema.

    Serialized from the User ORM model for API responses.

    Attributes:
        id: Internal Pilotly user ID.
        instagram_user_id: Instagram-scoped user ID.
        username: Instagram username.
        full_name: Display name (optional).
        profile_picture_url: Profile picture URL (optional).
        auto_reply_enabled: Whether AI auto-reply is active.
        reply_tone: Current reply tone preset.
        reply_style: Custom reply style description (optional).
        is_active: Whether the account is active.
        created_at: Account creation timestamp.
    """

    id: int
    instagram_user_id: str
    username: str
    full_name: str | None = None
    biography: str | None = None
    followers_count: int | None = None
    follows_count: int | None = None
    media_count: int | None = None
    profile_picture_url: str | None = None
    auto_reply_enabled: bool
    reply_tone: str
    reply_style: str | None = None
    is_active: bool
    created_at: datetime


    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    """Request schema for updating user reply settings.

    All fields are optional — only provided fields are updated.

    Attributes:
        auto_reply_enabled: Toggle AI auto-reply on/off.
        reply_tone: Change the reply tone preset.
        reply_style: Change the custom reply style description.
    """

    auto_reply_enabled: bool | None = None
    reply_tone: str | None = None
    reply_style: str | None = None
