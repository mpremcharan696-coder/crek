"""Authentication and session schemas for Pilotly."""

from pydantic import BaseModel


class TokenResponse(BaseModel):
    """Response schema returned after successful authentication.

    Attributes:
        access_token: JWT session token for authenticating subsequent API calls.
        token_type: Token type, always 'bearer'.
        expires_in: Token validity duration in seconds.
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int
