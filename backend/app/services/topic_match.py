"""Text-only: decide if a keyword summary matches user topic intent (YES/NO)."""

from __future__ import annotations

from google import genai
from vertexai.generative_models import GenerativeModel

MATCH_PROMPT = """You judge whether a short-form video matches what the user wants to watch.

User topics / intent (what they asked for):
{topics}

Keywords describing this video (from an automated summary):
{summary}

If the video is clearly related to or plausibly matches the user's topics, answer YES.
If it is unrelated, off-topic, or only a weak stretch, answer NO.

Reply with exactly one word: YES or NO."""


def _parse_yes_no(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Empty response from topic matcher")
    first = raw.split()[0].lower().strip(".,!?\"'")
    if first in ("yes", "y", "true"):
        return True
    if first in ("no", "n", "false"):
        return False
    raise ValueError(f"Expected YES or NO, got: {raw!r}")


def match_summary_to_topics_gemini(
    summary: str,
    topics: str,
    *,
    api_key: str,
    model: str,
) -> bool:
    client = genai.Client(api_key=api_key)
    prompt = MATCH_PROMPT.format(topics=topics.strip(), summary=summary.strip())
    response = client.models.generate_content(model=model, contents=[prompt])
    out = getattr(response, "text", None)
    if not out:
        raise RuntimeError("Gemini returned no text for topic match")
    return _parse_yes_no(out)


def match_summary_to_topics_vertex(
    summary: str,
    topics: str,
    *,
    model_name: str,
) -> bool:
    prompt = MATCH_PROMPT.format(topics=topics.strip(), summary=summary.strip())
    model = GenerativeModel(model_name)
    response = model.generate_content([prompt])
    out = getattr(response, "text", None)
    if not out:
        raise RuntimeError("Vertex returned no text for topic match")
    return _parse_yes_no(out)
