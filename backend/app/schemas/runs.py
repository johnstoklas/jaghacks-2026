from datetime import datetime

from pydantic import BaseModel, Field


class SeedKeywordGroup(BaseModel):
    seed: str
    keywords: list[str]


class RunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    topics: str = Field(..., min_length=1)
    seed_words: list[str] | None = Field(default=None, max_length=20)


class RunCreated(BaseModel):
    id: int
    keyword_expansion: list[SeedKeywordGroup] | None = None


class RunUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    topics: str | None = Field(None, min_length=1)


class RunOut(BaseModel):
    id: int
    name: str
    topics: str
    created_at: datetime
    keyword_expansion: list[SeedKeywordGroup] | None = None

    model_config = {"from_attributes": True}


class SavedReelOut(BaseModel):
    id: int
    run_id: int
    reel_ref: str | None
    created_at: datetime
    video_url: str


class MatchOut(BaseModel):
    match: bool
    topic_matches: dict[str, bool]
