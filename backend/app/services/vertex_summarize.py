"""Vertex AI Gemini via GCS (prompt text aligned with AIDEN example)."""

from __future__ import annotations

import uuid
from datetime import datetime

from google.cloud import storage
from vertexai.generative_models import GenerativeModel, Part

VERTEX_KEYWORD_PROMPT = """This is a short-form video from a social media platform. We are trying to discover insights into a user's interests based on the content of this video.
Please return a comma-separated list of 10-20 keywords that would describe the content of this video.
For example, a silly cat video might have the list "cat, funny, playful, cute, humorous, etc.".
Output just the list, nothing else."""


def summarize_video_gcs(
    local_path: str,
    *,
    project_id: str,
    bucket_name: str,
    model_name: str,
    mime_type: str = "video/mp4",
    delete_blob_after: bool = True,
) -> str:
    storage_client = storage.Client(project=project_id)
    bucket = storage_client.bucket(bucket_name)
    object_name = f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:12]}.mp4"
    blob = bucket.blob(object_name)

    blob.upload_from_filename(local_path, content_type=mime_type)
    gcs_uri = f"gs://{bucket_name}/{object_name}"

    try:
        video_part = Part.from_uri(uri=gcs_uri, mime_type=mime_type)
        model = GenerativeModel(model_name)
        response = model.generate_content([video_part, VERTEX_KEYWORD_PROMPT])
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Vertex Gemini returned no text for this video")
        return text.strip()
    finally:
        if delete_blob_after:
            try:
                blob.delete()
            except Exception:
                pass
