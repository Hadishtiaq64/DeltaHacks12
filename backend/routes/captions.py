"""
Caption generation routes - uses VideoDB's indexing for transcription
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from services.videodb_client import get_videodb_client

router = APIRouter()


class CaptionRequest(BaseModel):
    video_id: str


class Caption(BaseModel):
    start: float
    end: float
    text: str


class CaptionResponse(BaseModel):
    video_id: str
    captions: List[Caption]


@router.post("/captions/generate", response_model=CaptionResponse)
async def generate_captions(request: CaptionRequest):
    """Generate captions for a video using VideoDB's transcription"""
    try:
        client = get_videodb_client()
        video = client.get_video(request.video_id)
        
        # Index the video for spoken words (this triggers transcription)
        # VideoDB uses its own AI to transcribe
        video.index_spoken_words()
        
        # Get the transcript
        transcript = video.get_transcript()
        
        # Convert to our caption format
        captions = []
        if transcript and hasattr(transcript, 'segments'):
            for segment in transcript.segments:
                captions.append(Caption(
                    start=segment.start,
                    end=segment.end,
                    text=segment.text
                ))
        elif transcript and isinstance(transcript, list):
            for segment in transcript:
                captions.append(Caption(
                    start=segment.get('start', 0),
                    end=segment.get('end', 0),
                    text=segment.get('text', '')
                ))
        
        return CaptionResponse(
            video_id=request.video_id,
            captions=captions
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/captions/{video_id}", response_model=CaptionResponse)
async def get_captions(video_id: str):
    """Get existing captions for a video"""
    try:
        client = get_videodb_client()
        video = client.get_video(video_id)
        
        # Try to get existing transcript
        transcript = video.get_transcript()
        
        captions = []
        if transcript and hasattr(transcript, 'segments'):
            for segment in transcript.segments:
                captions.append(Caption(
                    start=segment.start,
                    end=segment.end,
                    text=segment.text
                ))
        elif transcript and isinstance(transcript, list):
            for segment in transcript:
                captions.append(Caption(
                    start=segment.get('start', 0),
                    end=segment.get('end', 0),
                    text=segment.get('text', '')
                ))
        
        return CaptionResponse(
            video_id=video_id,
            captions=captions
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
