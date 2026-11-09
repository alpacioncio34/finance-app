from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.db import engine, init_db
from app.routers import accounts, auth, budgets, categories, dashboard, transactions
from app.seed import seed_categories
from app.services.auth import get_current_user


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_categories(session)
    yield


app = FastAPI(title="Finance API", version="0.1.0", lifespan=lifespan)

# Dev-friendly CORS so the Expo web build can call the API. Tighten before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# /auth/register and /auth/login stay public; everything else requires a valid Bearer token.
app.include_router(auth.router)
for r in (accounts, categories, transactions, budgets, dashboard):
    app.include_router(r.router, dependencies=[Depends(get_current_user)])


@app.get("/health")
def health():
    return {"status": "ok"}
