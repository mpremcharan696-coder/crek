"""Application configuration loaded from environment variables.

Uses pydantic-settings to parse .env and validate all required config at
startup.  A singleton ``settings`` instance is exported for import throughout
the codebase.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the Pilotly backend.

    Every setting can be overridden via an environment variable of the same
    name.  Secrets should *never* be committed — use ``.env`` locally and
    proper secret management in production.
    """

    # ── Database (Supabase / Neon PostgreSQL via asyncpg) ────────────────
    DATABASE_URL: str

    # ── Redis (Upstash) ─────────────────────────────────────────────────
    REDIS_URL: str

    # ── Meta (Facebook / Instagram) ─────────────────────────────────────
    META_APP_ID: str = "1925137338445520"
    META_APP_SECRET: str = "99a029b28be71b189990343d63691cbb"
    META_VERIFY_TOKEN: str = "pilotly_test_123"
    META_REDIRECT_URI: str = "https://pilotly-api-server-543261599288.us-central1.run.app/api/v1/auth/callback"
    FRONTEND_URL: str = "https://crekai-gamma.vercel.app"


    # ── Direct Testing Token ─────────────────────────────────────────────
    # Set these to bypass OAuth during development/testing.
    # When META_ACCESS_TOKEN is set, you can use POST /api/v1/auth/setup-test
    # to seed your user without going through the OAuth flow.
    META_ACCESS_TOKEN: str = ""       # Your Meta Business API access token
    META_INSTAGRAM_USER_ID: str = ""  # Your Instagram Business Account ID

    # ── Groq / xAI / AI Providers ─────────────────────────────────────────
    GROQ_API_KEY: str = ""           # Optional fallback text LLM
    XAI_API_KEY: str = ""            # xAI (Grok API key)
    GEMINI_API_KEY: str = ""         # Google Gemini 2.5 Flash API key
    TAVILY_API_KEY: str = ""         # Web search API key
    OPENROUTER_API_KEY: str = "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"


    # ── Security ────────────────────────────────────────────────────────
    ENCRYPTION_KEY: str  # Fernet key for token-at-rest encryption
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # ── Application ─────────────────────────────────────────────────────
    APP_ENV: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    DISABLE_BG_WORKERS: bool = False

    # ── Meta Graph API ──────────────────────────────────────────────────
    META_GRAPH_API_VERSION: str = "v23.0"
    META_GRAPH_API_BASE: str = "https://graph.facebook.com"

    @property
    def sqlalchemy_database_url(self) -> str:
        """Ensure the database URL uses postgresql+asyncpg:// scheme and asyncpg-compatible params."""
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # asyncpg parameters cleanup:
        # replace sslmode= with ssl=
        url = url.replace("sslmode=require", "ssl=require").replace("sslmode=prefer", "ssl=prefer").replace("sslmode=disable", "ssl=disable")
        # asyncpg does not support channel_binding query parameter
        url = url.replace("channel_binding=require&", "").replace("&channel_binding=require", "").replace("?channel_binding=require", "?")
        if url.endswith("?"):
            url = url[:-1]
        return url

    @property
    def meta_graph_url(self) -> str:
        """Fully-qualified base URL for Meta Graph API requests."""
        return f"{self.META_GRAPH_API_BASE}/{self.META_GRAPH_API_VERSION}"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse the comma-separated ALLOWED_ORIGINS string into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
