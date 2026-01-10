"""
Edit routes for video processing operations
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.videodb_client import get_videodb_client

router = APIRouter()


class TrimRequest(BaseModel):
    video_id: str
    start: float
    end: float


class TextOverlayRequest(BaseModel):
    video_id: str
    text: str
    start: float = 0
    duration: float = 5
    position: str = "center"


class EditResponse(BaseModel):
    stream_url: str
    status: str = "success"


@router.post("/edit/trim", response_model=EditResponse)
async def trim_video(request: TrimRequest):
    """Trim video to specified start and end times"""
    try:
        client = get_videodb_client()
        result = client.trim_video(request.video_id, request.start, request.end)
        return EditResponse(stream_url=result["stream_url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/edit/text-overlay", response_model=EditResponse)
async def add_text_overlay(request: TextOverlayRequest):
    """Add text overlay to video"""
    try:
        client = get_videodb_client()
        result = client.add_text_overlay(
            request.video_id,
            request.text,
            request.start,
            request.duration,
            request.position
        )
        return EditResponse(stream_url=result["stream_url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
