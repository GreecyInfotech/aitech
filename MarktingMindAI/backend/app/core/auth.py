from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import Depends, Header, HTTPException

ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_SUPER_ADMIN = "super_admin"

ALL_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_USER]


@dataclass
class AuthUserRecord:
    id: str
    name: str
    email: str
    password: str
    role: str


_USERS_BY_EMAIL: Dict[str, AuthUserRecord] = {
    "superadmin@marketingmind.ai": AuthUserRecord(
        id="u-super-1",
        name="Super Admin",
        email="superadmin@marketingmind.ai",
        password="Super@123",
        role=ROLE_SUPER_ADMIN,
    ),
    "admin@marketingmind.ai": AuthUserRecord(
        id="u-admin-1",
        name="Admin User",
        email="admin@marketingmind.ai",
        password="Admin@123",
        role=ROLE_ADMIN,
    ),
    "user@marketingmind.ai": AuthUserRecord(
        id="u-user-1",
        name="Read Only User",
        email="user@marketingmind.ai",
        password="User@123",
        role=ROLE_USER,
    ),
}

_TOKENS: Dict[str, str] = {}
_LOCK = RLock()


class AuthError(Exception):
    pass


def _clean_email(email: str) -> str:
    return email.strip().lower()


def _sanitize_user(record: AuthUserRecord) -> dict:
    return {
        "id": record.id,
        "name": record.name,
        "email": record.email,
        "role": record.role,
    }


def get_auth_options() -> dict:
    return {
        "roles": ALL_ROLES,
        "demoUsers": [
            {
                "name": "Super Admin",
                "email": "superadmin@marketingmind.ai",
                "password": "Super@123",
                "role": ROLE_SUPER_ADMIN,
            },
            {
                "name": "Admin User",
                "email": "admin@marketingmind.ai",
                "password": "Admin@123",
                "role": ROLE_ADMIN,
            },
            {
                "name": "Read Only User",
                "email": "user@marketingmind.ai",
                "password": "User@123",
                "role": ROLE_USER,
            },
        ],
    }


def login_user(email: str, password: str) -> dict:
    clean_email = _clean_email(email)
    with _LOCK:
        record = _USERS_BY_EMAIL.get(clean_email)
        if not record or record.password != password:
            raise AuthError("Invalid email or password.")

        token = str(uuid4())
        _TOKENS[token] = record.email
        return {
            "token": token,
            "user": _sanitize_user(record),
        }


def register_user(name: str, email: str, password: str, role: str = ROLE_USER) -> dict:
    clean_email = _clean_email(email)
    requested_role = role.strip().lower()

    if requested_role not in ALL_ROLES:
        raise AuthError("Invalid role.")

    with _LOCK:
        if clean_email in _USERS_BY_EMAIL:
            raise AuthError("User already exists for this email.")

        user_id = f"u-{uuid4().hex[:8]}"
        record = AuthUserRecord(
            id=user_id,
            name=name.strip() or "New User",
            email=clean_email,
            password=password,
            role=requested_role,
        )
        _USERS_BY_EMAIL[clean_email] = record

        token = str(uuid4())
        _TOKENS[token] = record.email

        return {
            "token": token,
            "user": _sanitize_user(record),
        }


def logout_user(token: str) -> None:
    with _LOCK:
        _TOKENS.pop(token, None)


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authorization header must be Bearer token.")

    return parts[1].strip()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    token = _extract_token(authorization)

    with _LOCK:
        email = _TOKENS.get(token)
        if not email:
            raise HTTPException(status_code=401, detail="Invalid or expired session token.")

        record = _USERS_BY_EMAIL.get(email)
        if not record:
            raise HTTPException(status_code=401, detail="User session is no longer valid.")

        user = _sanitize_user(record)
        user["token"] = token
        return user


def require_roles(*allowed_roles: str):
    allowed = {role.lower() for role in allowed_roles}

    def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"].lower() not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role permissions for this endpoint.")
        return current_user

    return _dependency
