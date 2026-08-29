# Pilotly models package.
# Importing all models here ensures that SQLAlchemy's declarative Base
# registers all models before configure_mappers() is called. This prevents
# InvalidRequestError (mappers failing to initialize) in background workers.

from app.models.base import Base
from app.models.user import User, UserToken
from app.models.reel import Reel, ReelSummary
from app.models.comment import Comment, CommentReply
from app.models.dm_rule import CommentDMRule
from app.models.reel_automation import ReelAutomationConfig

__all__ = [
    "Base",
    "User",
    "UserToken",
    "Reel",
    "ReelSummary",
    "Comment",
    "CommentReply",
    "CommentDMRule",
    "ReelAutomationConfig",
]
