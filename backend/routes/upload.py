"""
Upload routes for video and audio files
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.videodb_client import get_videodb_client

router = APIRouter()


class UploadRequest(BaseModel):
    url: str
    name: Optional[str] = None


class UploadResponse(BaseModel):
    id: str
    name: str
    length: float
    stream_url: Optional[str] = None


@router.post("/upload/video", response_model=UploadResponse)
async def upload_video(request: UploadRequest):
    """Upload a video from URL"""
    try:
        client = get_videodb_client()
        result = client.upload_video(request.url, request.name)
        return UploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/audio", response_model=UploadResponse)
async def upload_audio(request: UploadRequest):
    """Upload audio from URL"""
    try:
        client = get_videodb_client()
        result = client.upload_audio(request.url, request.name)
        return UploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/videos")
async def list_videos():
    """List all uploaded videos"""
    try:
        client = get_videodb_client()
        return client.list_videos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
