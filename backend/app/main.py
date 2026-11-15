import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import accounts, auth, bank, budgets, categories, dashboard, transactions
from app.services.auth import check_auth_config, get_current_user


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_auth_config()  # refuse to start with a missing or weak JWT_SECRET
    init_db()
    yield


app = FastAPI(title="Finance API", version="0.2.0", lifespan=lifespan)

# Which web origins may call the API. "*" is for local development only: set CORS_ORIGINS to the
# real origin(s), comma-separated, before deploying. Tokens travel in the Authorization header,
# not in cookies, so credentials are never allowed here.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public: /health, /auth/register, /auth/login, /auth/refresh, /auth/logout and the sandbox bank's consent page.
# Everything else requires a valid Bearer token, and every query is scoped to that user.
app.include_router(auth.router)
app.include_router(bank.public_router)
for r in (accounts, categories, transactions, budgets, dashboard, bank):
    app.include_router(r.router, dependencies=[Depends(get_current_user)])


@app.get("/health")
def health():
    return {"status": "ok"}
