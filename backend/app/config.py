from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    jwt_secret: str = "dev-only-secret-please-change-in-env-file"  # 与 DEFAULT_JWT_SECRET 一致
    jwt_expire_hours: int = 24 * 7
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"
    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_mb: int = 500
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # 前端构建产物目录；存在时由后端直接托管，部署只需一个端口
    frontend_dist: Path = BASE_DIR.parent / "frontend" / "dist"
    # production 时强制要求自定义 JWT_SECRET
    app_env: str = "development"


DEFAULT_JWT_SECRET = "dev-only-secret-please-change-in-env-file"


settings = Settings()
