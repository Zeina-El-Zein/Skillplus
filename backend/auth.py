from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.context import CryptContext

from database import get_db
from schemas import SignupRequest, LoginRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])
#use bcrypt for hashing passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

#checks if the typed password matches the saved hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

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