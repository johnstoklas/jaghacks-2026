# Project: Instagram FYP editor

## What we’re building

A **Chrome extension** plus this **FastAPI backend** that work together as an **Instagram For You Page (FYP) editor**:

1. **Capture reels** — While the user is on Reels, the extension can download the **current reel** and **prefetch the next N reels** (teammates own prefetch/queue logic).
2. **Summarize each reel** — Each video is sent to this server (multipart `video` field) so **Gemini** (Vertex AI + GCS or Google AI API) returns a **comma-separated keyword summary** of the content.
3. **Match user intent** — The client asks what the user **wants** to watch (e.g. topics, vibe). Summaries are compared to that intent so the extension can decide **keep watching** vs **auto-scroll** to the next reel.
4. **Future ideas** — Persist a **playlist of “matched” reels** (possibly DB + lightweight auth), optionally **export or replay** clips locally. Native “Instagram Saved playlists” are not available via a public API; we’d store **our own** list or downloads.

## What this backend does today

- **`POST /api/upload-and-summarize`** — Gemini Developer API (API key).
- **`POST /api/upload-and-summarize-vertex`** — Compress with ffmpeg → upload to **GCS** → **Vertex AI** Gemini (team GCP defaults). Same JSON shape: `{"summary": "..."}`.
- **`POST /api/runs/{run_id}/upload-and-match`** / **`.../upload-and-match-vertex`** — Same video upload; loads `Run.topics`, summarizes, returns `match` + per-topic booleans. **`POST .../saved-reels`** (multipart video) persists clips under `data/reels/` (see README).

See [README.md](README.md) for run instructions and env vars.

## Architecture notes (for the team)

- **Prefetch → POST**: The extension can queue reels and call summarize **one POST per reel** (simple) or evolve to **batch/async** if we hit timeouts or rate limits.
- **Efficiency (later)**: Concurrency caps, shorter clips for “match/no-match,” caching by reel id if needed; optional DB for playlists and replay metadata.

## Disclaimer

This is a **hackathon / prototype**. Automating Instagram clients may conflict with **Instagram’s Terms of Service** and can break when the site changes. Use responsibly and for demo purposes unless you have proper authorization.
