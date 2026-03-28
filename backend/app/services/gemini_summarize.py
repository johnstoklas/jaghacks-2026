import time
from pathlib import Path

from google import genai
from google.genai import types

SUMMARY_PROMPT = (
    "Summarize this video in a few short topical keywords only, "
    "comma-separated, no full sentences (e.g. cooking, travel, comedy)."
)


def _wait_until_active(client: genai.Client, uploaded: types.File, timeout_s: float = 120.0) -> types.File:
    deadline = time.monotonic() + timeout_s
    f = uploaded
    while f.state != types.FileState.ACTIVE:
        if f.state == types.FileState.FAILED:
            raise RuntimeError("Gemini file processing failed")
        if time.monotonic() > deadline:
            raise TimeoutError("Timed out waiting for uploaded file to become ACTIVE")
        time.sleep(1.0)
        f = client.files.get(name=f.name)
    return f


def summarize_video_path(
    path: str | Path,
    *,
    api_key: str,
    model: str,
    mime_type: str,
) -> str:
    path = Path(path)
    client = genai.Client(api_key=api_key)

    uploaded = client.files.upload(
        file=str(path),
        config=types.UploadFileConfig(mime_type=mime_type),
    )
    uploaded = _wait_until_active(client, uploaded)

    response = client.models.generate_content(
        model=model,
        contents=[uploaded, SUMMARY_PROMPT],
    )

    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Gemini returned no text for this video")

    return text.strip()
