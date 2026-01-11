"""
Video routes for timeline operations
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.videodb_client import get_videodb_client
from videodb.timeline import Timeline
from videodb.asset import VideoAsset

router = APIRouter()

class VideoClip(BaseModel):
    id: str
    source_id: Optional[str] = None
    start: float = 0
    end: float = 0
    stream_url: Optional[str] = None
    name: Optional[str] = None
    length: Optional[float] = None

class AudioClip(BaseModel):
    id: str
    source_id: Optional[str] = None
    start: float = 0        # Source trim start
    end: Optional[float] = None
    timeline_start: float = 0 # Timeline placement start

class TimelineRequest(BaseModel):
    clips: List[VideoClip]
    audio_clips: List[AudioClip] = []

@router.post("/video/render-timeline")
async def render_timeline(request: TimelineRequest):
    """
    Generate a stream URL for a sequence of video clips and audio overlays.
    Implements the "Two Start Parameters" logic:
    1. asset.start (Source Trimming)
    2. timeline.add_overlay(start=...) (Timeline Positioning)
    """
    try:
        client = get_videodb_client()
        timeline = Timeline(client.conn)
        
        # 1. Process Video Track (Sequential/Magnetic)
        if request.clips:
            for clip in request.clips:
                asset_id = clip.source_id if clip.source_id else clip.id
                start = clip.start if clip.start is not None else 0
                end = clip.end if clip.end is not None and clip.end > start else None
                
                video_asset = VideoAsset(
                    asset_id=asset_id,
                    start=start,
                    end=end
                )
                timeline.add_inline(video_asset)
        
        # 2. Process Audio Track (Overlays/Free Placement)
        from videodb.asset import AudioAsset
        if request.audio_clips:
            for audio in request.audio_clips:
                asset_id = audio.source_id if audio.source_id else audio.id
                
                # Source Trimming
                audio_asset = AudioAsset(
                    asset_id=asset_id,
                    start=audio.start,
                    end=audio.end,
                    disable_other_tracks=False, # Overlay, don't replace
                    fade_in_duration=1,
                    fade_out_duration=1
                )
                
                # Timeline Positioning
                timeline.add_overlay(
                    start=audio.timeline_start,
                    asset=audio_asset
                )
            
        stream_url = timeline.generate_stream()
        
        return {
            "stream_url": stream_url,
            "status": "rendered",
            "message": "Timeline updated successfully"
        }
        
    except Exception as e:
        print(f"Render Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
