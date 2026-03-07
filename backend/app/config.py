from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """
    Central backend configuration.

    All values can be overridden via environment variables or a .env file
    in the backend directory.  In production, set ENV=production and supply
    real values for CORS_ORIGINS, DATABASE_URL, etc.
    """
    # Runtime environment: "development" | "production"
    ENV: str = "development"

    # External services
    CDISC_API_KEY: str = ""
    CDISC_LIBRARY_BASE_URL: str = "https://library.cdisc.org/api"
    CTGOV_BASE_URL: str = "https://clinicaltrials.gov/api/v2"
    SDR_BASE_URL: str = "http://localhost:5000"

    # CORS — comma-separated string in env, or JSON list
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
    ]

    # Neo4j graph database
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "trialforge_dev"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    class Config:
        env_file = ".env"


settings = Settings()
