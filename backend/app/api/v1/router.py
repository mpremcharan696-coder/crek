"""Aggregated API v1 router.

Collects all feature-specific sub-routers under the ``/api/v1`` prefix so that
``main.py`` only has to include a single router instance.
"""

from fastapi import APIRouter

from app.api.v1.routers import auth, webhooks, reels, comments, users, demo, dm_automations, reel_automations

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(
    demo.router,
    prefix="/demo",
    tags=["demo"],
)

api_v1_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)
api_v1_router.include_router(
    webhooks.router,
    prefix="/webhooks",
    tags=["Webhooks"],
)
api_v1_router.include_router(
    reels.router,
    prefix="/reels",
    tags=["Reels"],
)
api_v1_router.include_router(
    reel_automations.router,
    tags=["Reel Custom Automations"],
)
api_v1_router.include_router(
    comments.router,
    prefix="/comments",
    tags=["Comments"],
)
api_v1_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)
api_v1_router.include_router(
    dm_automations.router,
    prefix="/dm-rules",
    tags=["Comment to DM Automations"],
)
