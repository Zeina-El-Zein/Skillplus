from fastapi import FastAPI
from auth import router as auth_router

app = FastAPI(title="Skill+ Backend")

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "Skill+ backend is running"}