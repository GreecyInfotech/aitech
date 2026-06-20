import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.database import init_sql_tables


def _warm_embedding_backend() -> None:
    try:
        from app.services.embedding_service import get_embedding_status

        status = get_embedding_status()
        if status.get("available"):
            print(f"[OK] Embeddings ready ({status.get('backend')}: {status.get('model')})")
        else:
            print(f"[WARN] Embeddings unavailable: {status.get('error', 'unknown')}")
    except Exception as exc:
        print(f"[WARN] Embedding warmup failed: {exc}")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize databases on startup"""
    print("Starting MarketingMind AI backend...")

    # SQL database (PostgreSQL by default)
    try:
        init_sql_tables()
        print("[OK] SQL database tables ready")
        from app.services.pg_auth import ensure_auth_ready

        ensure_auth_ready()
        print("[OK] PostgreSQL auth/workspace seed verified")
    except Exception as e:
        print(f"[WARN] SQL database init failed: {e}")

    threading.Thread(target=_warm_embedding_backend, daemon=True).start()


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown"""
    print("Shutting down MarketingMind AI backend...")


app.include_router(router)
