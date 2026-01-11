"""
Audio routes for uploading and merging audio with video
"""
import os
import tempfile
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from services.videodb_client import get_videodb_client
from services.ffmpeg_service import merge_audio_with_video_stream

router = APIRouter()

# Store merged files temporarily (in production, use proper storage)
MERGED_FILES = {}


class AudioUploadRequest(BaseModel):
    url: str
    name: Optional[str] = None


class AudioUploadResponse(BaseModel):
    id: str
    name: str
    length: float


class AddAudioRequest(BaseModel):
    video_id: str
    audio_id: str


class AddAudioResponse(BaseModel):
    stream_url: str
    video_id: str
    audio_id: str


class FFmpegMergeRequest(BaseModel):
    video_stream_url: str


class FFmpegMergeResponse(BaseModel):
    merged_url: str
    file_id: str


@router.post("/audio/upload", response_model=AudioUploadResponse)
async def upload_audio(request: AudioUploadRequest):
    """Upload audio from URL"""
    try:
        client = get_videodb_client()
        result = client.upload_audio(request.url, request.name)
        return AudioUploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio/merge-local")
async def merge_audio_local(
    video_stream_url: str,
    file: UploadFile = File(...)
):
    """
    Merge uploaded audio file with video using FFmpeg locally.
    Returns URL to download merged video.
    """
    try:
        # Save uploaded audio to temp file
        suffix = os.path.splitext(file.filename or ".mp3")[1]
        audio_temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        content = await file.read()
        audio_temp.write(content)
        audio_temp.close()
        
        try:
            # Merge using FFmpeg
            merged_path = await merge_audio_with_video_stream(
                video_stream_url,
                audio_temp.name
            )
            
            # Generate file ID for retrieval
            file_id = str(uuid.uuid4())
            MERGED_FILES[file_id] = {
                "path": merged_path,
                "name": f"merged_{file.filename}"
            }
            
            return {
                "success": True,
                "file_id": file_id,
                "merged_url": f"/api/audio/merged/{file_id}",
                "message": "Audio merged successfully with FFmpeg!"
            }
            
        finally:
            # Clean up audio temp
            if os.path.exists(audio_temp.name):
                os.unlink(audio_temp.name)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg merge failed: {str(e)}")


@router.get("/audio/merged/{file_id}")
async def get_merged_file(file_id: str):
    """Serve merged video file"""
    if file_id not in MERGED_FILES:
        raise HTTPException(status_code=404, detail="Merged file not found")
    
    file_info = MERGED_FILES[file_id]
    if not os.path.exists(file_info["path"]):
        raise HTTPException(status_code=404, detail="File no longer available")
    
    return FileResponse(
        file_info["path"],
        media_type="video/mp4",
        filename=file_info["name"]
    )


@router.post("/audio/add-to-video", response_model=AddAudioResponse)
async def add_audio_to_video(request: AddAudioRequest):
    """Add background audio to a video using VideoDB"""
    try:
        client = get_videodb_client()
        result = client.add_audio_to_video(request.video_id, request.audio_id)
        return AddAudioResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
