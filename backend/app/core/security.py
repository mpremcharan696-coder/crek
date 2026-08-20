"""Security utilities: webhook verification, token encryption, JWT sessions.

This module intentionally keeps each concern in its own section so callers can
import only what they need::

    from app.core.security import verify_webhook_signature, create_jwt
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# 1. HMAC Webhook Signature Verification
# ═══════════════════════════════════════════════════════════════════════════


def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify the ``X-Hub-Signature-256`` header sent by Meta webhooks.

    Args:
        body: Raw request body bytes.
        signature: Value of the ``X-Hub-Signature-256`` header
                   (e.g. ``sha256=abc123…``).
        secret: The Meta app secret used as the HMAC key.

    Returns:
        ``True`` when the signature is valid, ``False`` otherwise.
    """
    if not signature or not secret:
        logger.warning("Webhook signature verification called with empty signature or secret")
        return False

    expected = "sha256=" + hmac.new(
        key=secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


# ═══════════════════════════════════════════════════════════════════════════
# 2. Fernet Token Encryption (for storing Meta access-tokens at rest)
# ═══════════════════════════════════════════════════════════════════════════


def encrypt_token(token: str, key: str) -> bytes:
    """Encrypt a plaintext token string with Fernet symmetric encryption.

    Args:
        token: The plaintext access-token to encrypt.
        key: A URL-safe base64-encoded Fernet key (32 bytes).

    Returns:
        The encrypted ciphertext as ``bytes``.

    Raises:
        ValueError: If the key is not a valid Fernet key.
    """
    try:
        fernet = Fernet(key.encode("utf-8"))
        return fernet.encrypt(token.encode("utf-8"))
    except Exception as exc:
        logger.error("Token encryption failed: %s", exc)
        raise ValueError("Failed to encrypt token — check ENCRYPTION_KEY") from exc


def decrypt_token(encrypted: bytes, key: str) -> str:
    """Decrypt a Fernet-encrypted token back to plaintext.

    Args:
        encrypted: The ciphertext bytes produced by :func:`encrypt_token`.
        key: The same Fernet key used for encryption.

    Returns:
        The original plaintext token string.

    Raises:
        ValueError: If decryption fails (wrong key or corrupted data).
    """
    try:
        fernet = Fernet(key.encode("utf-8"))
        return fernet.decrypt(encrypted).decode("utf-8")
    except InvalidToken as exc:
        logger.error("Token decryption failed — invalid key or corrupted ciphertext")
        raise ValueError("Failed to decrypt token — invalid key or corrupted data") from exc
    except Exception as exc:
        logger.error("Token decryption failed: %s", exc)
        raise ValueError("Failed to decrypt token") from exc


# ═══════════════════════════════════════════════════════════════════════════
# 3. JWT Session Management
# ═══════════════════════════════════════════════════════════════════════════


def create_jwt(
    user_id: int,
    secret: str,
    algorithm: str = "HS256",
    expiry_hours: int = 24,
) -> str:
    """Create a signed JWT containing the user's ID.

    Args:
        user_id: Database primary-key for the authenticated user.
        secret: HMAC secret for signing.
        algorithm: JWT signing algorithm (default ``HS256``).
        expiry_hours: Token lifetime in hours (default 24).

    Returns:
        The encoded JWT string.
    """
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=expiry_hours),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def verify_jwt(
    token: str,
    secret: str,
    algorithm: str = "HS256",
) -> dict[str, Any] | None:
    """Decode and verify a JWT, returning its payload or ``None``.

    Args:
        token: The encoded JWT string.
        secret: HMAC secret used when the token was created.
        algorithm: Expected signing algorithm (default ``HS256``).

    Returns:
        The decoded payload dict on success, or ``None`` if the token is
        invalid or expired.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            secret,
            algorithms=[algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT verification failed: token expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.debug("JWT verification failed: %s", exc)
        return None
