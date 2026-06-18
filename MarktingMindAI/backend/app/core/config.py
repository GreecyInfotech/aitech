from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MarketingMind AI API"
    environment: Literal["development", "staging", "production"] = "development"
    database_url: Optional[str] = "sqlite:///./marketingmind.db"
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    )
    allowed_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    use_seed_data: bool = True
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    # MongoDB Configuration
    mongodb_url: Optional[str] = "mongodb://localhost:27017"
    mongodb_db_name: Optional[str] = "marketingmind_ai"
    min_pool_size: int = 10
    max_pool_size: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
