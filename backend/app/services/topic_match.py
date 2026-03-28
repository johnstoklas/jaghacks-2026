"""Text-only: match a keyword summary to user topic list (overall + per-topic booleans)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Callable

from google import genai
from vertexai.generative_models import GenerativeModel

from app.utils.topics import parse_topics

STRUCTURED_MATCH_PROMPT = """You judge a short-form video against the user's topic list using only the keywords below.

User topics (evaluate each separately; keys in your JSON must match EXACTLY):
{topic_lines}

Keywords describing this video (from an automated summary):
{summary}

Reply with JSON ONLY, no markdown, no other text. Shape:
{{"match": <boolean>, "topics": {{ ... }}}}

Rules:
- "match": true if this video clearly fits what the user wants to watch overall (same idea as a single YES/NO on the whole set); false if unrelated or only a weak stretch.
- "topics": one boolean per user topic string above: true if this video is clearly related to that label (synonyms and semantics OK); false otherwise.
- Every topic string listed above must appear exactly once as a key in "topics", with the same spelling and spacing."""

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


@dataclass(frozen=True)
class TopicMatchResult:
    match: bool
    topic_matches: dict[str, bool]


def _extract_json_object(text: str) -> dict:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Empty response from topic matcher")
    m = _JSON_FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


def _validate_structured_match(data: dict, expected_topics: list[str]) -> TopicMatchResult:
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object from topic matcher")
    if "match" not in data or not isinstance(data["match"], bool):
        raise ValueError('Expected boolean "match" in topic matcher JSON')
    topics_obj = data.get("topics")
    if not isinstance(topics_obj, dict):
        raise ValueError('Expected object "topics" in topic matcher JSON')
    expected_set = set(expected_topics)
    got_set = set(topics_obj.keys())
    if expected_set != got_set:
        raise ValueError(
            f"Topic keys mismatch: expected {sorted(expected_set)!r}, got {sorted(got_set)!r}"
        )
    out: dict[str, bool] = {}
    for k in expected_topics:
        v = topics_obj[k]
        if not isinstance(v, bool):
            raise ValueError(f'Expected boolean for topic {k!r}, got {type(v).__name__}')
        out[k] = v
    return TopicMatchResult(match=data["match"], topic_matches=out)


def match_summary_to_topics_structured(
    summary: str,
    topics_raw: str,
    *,
    generate: Callable[[str], str],
) -> TopicMatchResult:
    topic_list = parse_topics(topics_raw)
    if not topic_list:
        raise ValueError("No topics after parsing; provide at least one comma-separated topic")
    topic_lines = "\n".join(f"- {t}" for t in topic_list)
    prompt = STRUCTURED_MATCH_PROMPT.format(topic_lines=topic_lines, summary=summary.strip())
    out_text = generate(prompt)
    data = _extract_json_object(out_text)
    return _validate_structured_match(data, topic_list)


def match_summary_to_topics_gemini(
    summary: str,
    topics: str,
    *,
    api_key: str,
    model: str,
) -> TopicMatchResult:
    client = genai.Client(api_key=api_key)

    def generate(prompt: str) -> str:
        response = client.models.generate_content(model=model, contents=[prompt])
        out = getattr(response, "text", None)
        if not out:
            raise RuntimeError("Gemini returned no text for topic match")
        return out

    return match_summary_to_topics_structured(summary, topics, generate=generate)


def match_summary_to_topics_vertex(
    summary: str,
    topics: str,
    *,
    model_name: str,
) -> TopicMatchResult:
    model = GenerativeModel(model_name)

    def generate(prompt: str) -> str:
        response = model.generate_content([prompt])
        out = getattr(response, "text", None)
        if not out:
            raise RuntimeError("Vertex returned no text for topic match")
        return out

    return match_summary_to_topics_structured(summary, topics, generate=generate)
