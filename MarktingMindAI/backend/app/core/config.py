from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MarketingMind AI API"
    environment: Literal["development", "staging", "production"] = "development"
    database_url: Optional[str] = "postgresql+psycopg://postgres:admin@localhost:5432/postgres"
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    )
    allowed_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    use_seed_data: bool = False
    use_mongodb: bool = False
    jwt_expiration_hours: int = 24
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    use_local_llm: bool = True
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral"
    ollama_timeout_seconds: int = 120
    resume_parse_llm_timeout_seconds: int = 10
    resume_parse_include_llm: bool = False
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_backend: Literal["auto", "sentence_transformers", "sklearn_tfidf"] = "auto"
    apify_api_token: Optional[str] = None
    apify_actor_id: str = "curious_coder/linkedin-jobs-scraper"
    use_apify_scraper: bool = True
    apify_jobs_per_search: int = 25
    apify_max_wait_seconds: int = 120

    # MongoDB Configuration
    mongodb_url: Optional[str] = "mongodb://localhost:27017"
    mongodb_db_name: Optional[str] = "marketingmind_ai"
    min_pool_size: int = 10
    max_pool_size: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
