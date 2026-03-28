import logging
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Gemini API route (google-genai + API key)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    max_upload_mb: int = 100

    # Vertex AI route (GCS + Vertex; use Application Default Credentials)
    # Accept common typo GCS_PROJECT_ID as alias for GCP_PROJECT_ID
    gcp_project_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GCP_PROJECT_ID", "GCS_PROJECT_ID"),
    )
    gcs_bucket: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GCS_BUCKET", "GCS_BUCKET_NAME"),
    )
    gcp_location: str = "us-central1"
    vertex_model: str = "gemini-2.0-flash-001"
    delete_gcs_after: bool = True

    compress_width: int = 540
    compress_height: int = 960
    compress_fps: int = 5

    # Database (single-tenant: runs + saved reels, no login)
    database_url: str = Field(
        default="sqlite:///./jaghacks.db",
        validation_alias=AliasChoices("DATABASE_URL"),
    )

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def vertex_configured(self) -> bool:
        return bool(self.gcp_project_id and self.gcs_bucket)

    @property
    def gemini_api_configured(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    logger.info(
        "Loaded settings from .env (cwd matters): gcp_project_id=%r gcs_bucket=%r gcp_location=%r "
        "vertex_configured=%s gemini_api_configured=%s vertex_model=%r",
        s.gcp_project_id,
        s.gcs_bucket,
        s.gcp_location,
        s.vertex_configured,
        s.gemini_api_configured,
        s.vertex_model,
    )
    return s
