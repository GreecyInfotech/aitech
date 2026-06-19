from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.mongodb_config import MongoDBConnection, init_collections
from app.db.database import init_sql_tables

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

    # MongoDB (optional)
    if settings.use_mongodb:
        try:
            MongoDBConnection.connect()
            init_collections()
            print("[OK] MongoDB initialized successfully")
        except Exception as e:
            print(f"[WARN] MongoDB connection failed: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown"""
    print("Shutting down MarketingMind AI backend...")
    MongoDBConnection.close()


app.include_router(router)
