import hashlib
import os
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.context import CryptContext

from database import get_db
from schemas import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
#use bcrypt for hashing passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
).rstrip("/")

GENERIC_RESET_MESSAGE = (
    "If an account exists, password reset instructions have been sent."
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

#checks if the typed password matches the saved hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

#sign up endpoint 
@router.post("/signup")
def signup(user: SignupRequest, db: Session = Depends(get_db)):
    #search for an existing user 
    existing_user = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": user.email}
    ).fetchone()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    #if user does not already exist 
    hashed_password = hash_password(user.password)
    #insert the user into the database 
    new_user = db.execute(
        text("""
            INSERT INTO users (name, email, password_hash, role)
            VALUES (:name, :email, :password_hash, :role)
            RETURNING id, name, email, role
        """),
        {
            "name": user.name,
            "email": user.email,
            "password_hash": hashed_password,
            "role": "student"
        }
    ).fetchone()

    db.commit() #save changes 

    return {
        "message": "User created successfully",
        "user": {#notice: response includes everything except the password 
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        }
    }


@router.post("/login")
def login(user: LoginRequest, db: Session = Depends(get_db)):
    existing_user = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": user.email}
    ).fetchone()

    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(user.password, existing_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return {
        "message": "Login successful",
        "user": {
            "id": existing_user.id,
            "name": existing_user.name,
            "email": existing_user.email,
            "role": existing_user.role
        }
    }

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    try:
        existing_user = db.execute(
            text("""
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER(:email)
            """),
            {"email": request.email}
        ).mappings().fetchone()

        # Always return the same response, even when the email does not exist.
        if existing_user is None:
            return {"message": GENERIC_RESET_MESSAGE}

        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_reset_token(raw_token)

        # Invalidate previous unused reset tokens for this user.
        db.execute(
            text("""
                UPDATE password_reset_tokens
                SET used_at = CURRENT_TIMESTAMP
                WHERE user_id = :user_id
                  AND used_at IS NULL
            """),
            {"user_id": existing_user["id"]}
        )

        db.execute(
            text("""
                INSERT INTO password_reset_tokens (
                    user_id,
                    token_hash,
                    expires_at
                )
                VALUES (
                    :user_id,
                    :token_hash,
                    CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                )
            """),
            {
                "user_id": existing_user["id"],
                "token_hash": token_hash,
            }
        )

        db.commit()

        reset_link = (
            f"{FRONTEND_URL}/reset-password?token={raw_token}"
        )

        # Development only.
        # Later, send this link by email instead of printing it.
        print("\nPASSWORD RESET LINK:")
        print(reset_link)
        print()

        return {"message": GENERIC_RESET_MESSAGE}

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not process the password reset request."
        )
    
@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    token_hash = hash_reset_token(request.token)

    try:
        reset_record = db.execute(
            text("""
                SELECT id, user_id
                FROM password_reset_tokens
                WHERE token_hash = :token_hash
                  AND used_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                FOR UPDATE
            """),
            {"token_hash": token_hash}
        ).mappings().fetchone()

        if reset_record is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token."
            )

        new_password_hash = hash_password(request.new_password)

        db.execute(
            text("""
                UPDATE users
                SET password_hash = :password_hash
                WHERE id = :user_id
            """),
            {
                "password_hash": new_password_hash,
                "user_id": reset_record["user_id"],
            }
        )

        # Invalidate the used token and any other active token.
        db.execute(
            text("""
                UPDATE password_reset_tokens
                SET used_at = CURRENT_TIMESTAMP
                WHERE user_id = :user_id
                  AND used_at IS NULL
            """),
            {"user_id": reset_record["user_id"]}
        )

        db.commit()

        return {
            "message": "Password reset successfully."
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not reset the password."
        )