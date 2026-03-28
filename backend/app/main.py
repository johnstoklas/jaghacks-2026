import logging
from contextlib import asynccontextmanager
from pathlib import Path

import vertexai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, runs, summarize

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Working directory (resolve .env path): %s", Path.cwd().resolve())
    settings = get_settings()
    if settings.vertex_configured and settings.gcp_project_id:
        vertexai.init(project=settings.gcp_project_id, location=settings.gcp_location)
        logger.info("vertexai.init OK for project=%r location=%r", settings.gcp_project_id, settings.gcp_location)
    else:
        logger.info(
            "Vertex not initialized (vertex_configured=%s). Vertex route needs GCP_PROJECT_ID "
            "and GCS_BUCKET in .env and server run from backend/ (or .env on cwd).",
            settings.vertex_configured,
        )
    yield


app = FastAPI(title="Instagram AI Scroller API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(summarize.router)
app.include_router(runs.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "Instagram AI Scroller API", "version": "1.0.0"}
