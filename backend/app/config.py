from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./protocol_authoring.db"
    CDISC_API_KEY: str = ""
    SDR_BASE_URL: str = "http://localhost:5000"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
