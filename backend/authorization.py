from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
#purpose: check if the user exists and if it exists make sure that the role is institution 

def require_institution(user_id: int, db: Session):
    user = db.execute(
        text("""
            SELECT id, role
            FROM users
            WHERE id = :user_id
        """),
        {"user_id": user_id}
    ).mappings().fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user["role"] != "institution":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only institution accounts can perform this action."
        )

    return user