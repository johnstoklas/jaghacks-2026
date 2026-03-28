"""LLM: expand topic seeds into Instagram-style search keywords per seed."""

from __future__ import annotations

import json
import re
from typing import Any, Callable

from google import genai
from vertexai.generative_models import GenerativeModel

from app.utils.topics import parse_topics

MAX_SEEDS = 20
MAX_KEYWORDS_PER_SEED = 15
MAX_KEYWORD_LEN = 128
MAX_SEED_LEN = 255

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)

EXPAND_PROMPT = """You suggest Instagram Reels search queries and hashtags related to each seed topic.

Seeds (expand each; reply with JSON referencing these exact strings as "seed"):
{seeds_json}

Reply with JSON ONLY, no markdown, no other text. Shape: a JSON array of objects. Each object has:
- "seed": string — must be exactly one of the seed strings above (same spelling).
- "keywords": array of strings — distinct, short Instagram search terms or hashtags (how users actually search). 3–12 items per seed when possible.

Rules:
- Include exactly one object per seed, in the same order as the seeds array above.
- Keywords must be unique within each seed; keep each keyword under {max_kw_len} characters.
- Prefer realistic search phrasing over generic single words when helpful."""


def _extract_json_array(text: str) -> list:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Empty response from keyword expander")
    m = _JSON_FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array from keyword expander")
    return data


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _normalize_keyword(s: str) -> str:
    t = (s or "").strip()
    if len(t) > MAX_KEYWORD_LEN:
        t = t[:MAX_KEYWORD_LEN]
    return t


def _validate_expansion_rows(data: list[Any], expected_seeds: list[str]) -> list[dict[str, Any]]:
    if len(data) != len(expected_seeds):
        raise ValueError(
            f"Expected {len(expected_seeds)} expansion rows, got {len(data)}"
        )
    out: list[dict[str, Any]] = []
    for i, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValueError(f"Expected object at index {i}")
        seed = row.get("seed")
        kws = row.get("keywords")
        if not isinstance(seed, str) or seed.strip() != expected_seeds[i]:
            raise ValueError(
                f'seed mismatch at index {i}: expected {expected_seeds[i]!r}, got {seed!r}'
            )
        if not isinstance(kws, list):
            raise ValueError(f'"keywords" must be a list at index {i}')
        keywords: list[str] = []
        for k in kws:
            if not isinstance(k, str):
                continue
            nk = _normalize_keyword(k)
            if nk:
                keywords.append(nk)
            if len(keywords) >= MAX_KEYWORDS_PER_SEED:
                break
        keywords = _dedupe_preserve_order(keywords)
        out.append({"seed": expected_seeds[i], "keywords": keywords})
    return out


def normalize_seeds_for_expansion(body_seed_words: list[str] | None, topics: str) -> list[str]:
    """Seeds for LLM: explicit seed_words if non-empty after normalize; else comma-split topics."""
    if body_seed_words is not None:
        out: list[str] = []
        for s in body_seed_words:
            t = (s or "").strip()
            if not t:
                continue
            t = t[:MAX_SEED_LEN]
            if t not in out:
                out.append(t)
            if len(out) >= MAX_SEEDS:
                break
        if out:
            return out
    return parse_topics(topics)[:MAX_SEEDS]


def expand_seeds_structured(
    seeds: list[str],
    *,
    generate: Callable[[str], str],
) -> list[dict[str, Any]]:
    if not seeds:
        raise ValueError("expand_seeds_structured requires at least one seed")
    seeds_json = json.dumps(seeds, ensure_ascii=False)
    prompt = EXPAND_PROMPT.format(seeds_json=seeds_json, max_kw_len=MAX_KEYWORD_LEN)
    out_text = generate(prompt)
    data = _extract_json_array(out_text)
    return _validate_expansion_rows(data, seeds)


def expand_seeds_gemini(
    seeds: list[str],
    *,
    api_key: str,
    model: str,
) -> list[dict[str, Any]]:
    client = genai.Client(api_key=api_key)

    def generate(prompt: str) -> str:
        response = client.models.generate_content(model=model, contents=[prompt])
        out = getattr(response, "text", None)
        if not out:
            raise RuntimeError("Gemini returned no text for keyword expansion")
        return out

    return expand_seeds_structured(seeds, generate=generate)


def expand_seeds_vertex(
    seeds: list[str],
    *,
    model_name: str,
) -> list[dict[str, Any]]:
    model = GenerativeModel(model_name)

    def generate(prompt: str) -> str:
        response = model.generate_content([prompt])
        out = getattr(response, "text", None)
        if not out:
            raise RuntimeError("Vertex returned no text for keyword expansion")
        return out

    return expand_seeds_structured(seeds, generate=generate)
