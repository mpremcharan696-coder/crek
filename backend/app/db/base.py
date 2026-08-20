"""Import all models so Alembic autogenerate can discover them.

Every new SQLAlchemy model module **must** be imported here so that its
tables are registered on ``Base.metadata`` before Alembic inspects it.

This module also re-exports ``Base`` for convenience::

    from app.db.base import Base
"""

from __future__ import annotations

# The declarative base — must be imported first
from app.models.base import Base  # noqa: F401

# ── Import every model to register its table on Base.metadata ───────────
from app.models.user import User, UserToken  # noqa: F401
from app.models.reel import Reel, ReelSummary  # noqa: F401
from app.models.comment import Comment, CommentReply  # noqa: F401

__all__ = [
    "Base",
    "User",
    "UserToken",
    "Reel",
    "ReelSummary",
    "Comment",
    "CommentReply",
]
