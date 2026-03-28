# Backend (FastAPI MVP)

**Project overview:** [PROJECT.md](PROJECT.md) (Instagram FYP editor — extension + summarization API).

Two summarization routes (same multipart field `video`, same JSON `{"summary": "..."}`) so you can compare **Gemini API (API key)** vs **Vertex AI + GCS**.

Run-scoped **topic match** routes take the same `video` field plus `run_id` in the path: they summarize internally, compare to `Run.topics`, and return `{"match": true|false}` (see table below).

## Database (single-tenant)

Runs and saved reels use **SQLite** by default (`DATABASE_URL=sqlite:///./jaghacks.db`) or **PostgreSQL** (e.g. Neon) if you set `DATABASE_URL` in `.env`. For Postgres, use the **`postgresql+psycopg://`** scheme (not plain `postgresql://`) so SQLAlchemy uses the bundled `psycopg` driver—paste Neon’s URL and only change the scheme. Keep `?sslmode=require` when Neon provides it.

There is **no login or JWT**: one global list of runs for the app instance. After cloning, create tables:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
```

Migrations live under `alembic/versions/` with numeric prefixes (e.g. `001_runs_saved_reels.py`, revision `001`). If you already applied an older revision id before this rename, either use a fresh DB or run `alembic stamp 001` so `alembic_version` matches.

## Gemini API route (extension default)

`POST /api/upload-and-summarize` — uses `GEMINI_API_KEY` and the Google GenAI Files API.

Set `GEMINI_API_KEY` in `.env` (see `.env.example`).

## Vertex AI route (team GCP)

`POST /api/upload-and-summarize-vertex` — ffmpeg compress (540×960 @ 5 fps by default) → upload to **GCS** → **Vertex** `GenerativeModel` with `gs://` URI.

**Defaults** (built into `app/config.py`; override in `.env` if needed):

| Setting | Default |
|---------|---------|
| `GCP_PROJECT_ID` | `hacktx-swiftui` |
| `GCS_BUCKET` | `instagram-scroller-project` |
| `GCP_LOCATION` | `us-south1` |
| `VERTEX_MODEL` | `gemini-2.0-flash-001` |

Use **Application Default Credentials** for an account that has access to that project:

```bash
gcloud auth application-default login
gcloud config set project hacktx-swiftui
```

Requires **ffmpeg** on `PATH`.

## Run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

Or: `python server.py`

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Liveness |
| GET | `/` | Service metadata |
| POST | `/api/upload-and-summarize` | API key route; returns 503 if `GEMINI_API_KEY` missing |
| POST | `/api/upload-and-summarize-vertex` | Vertex route; uses team GCP defaults unless overridden |
| POST | `/api/runs/{run_id}/upload-and-match` | API key; multipart `video`; JSON `{"match": bool}` vs run’s `topics` |
| POST | `/api/runs/{run_id}/upload-and-match-vertex` | Vertex path; same shape `{"match": bool}` |
| GET | `/api/runs` | List all runs |
| POST | `/api/runs` | JSON `{"name","topics"}` — create run |
| GET | `/api/runs/{run_id}` | Run detail |
| PATCH | `/api/runs/{run_id}` | Optional `name` / `topics` |
| DELETE | `/api/runs/{run_id}` | Deletes run and its saved reels |
| GET | `/api/runs/{run_id}/saved-reels` | List saved reels for that run |
| POST | `/api/runs/{run_id}/saved-reels` | JSON `{"reel_ref","summary"?}` — max 2048 chars for `reel_ref` |

Max upload size: `MAX_UPLOAD_MB` (default 100).

To A/B test with the browser extension, change the URL in `post.js` from `/api/upload-and-summarize` to `/api/upload-and-summarize-vertex`.

The old Flask prototype folder `AIDENA/` has been removed; use this FastAPI backend only.
