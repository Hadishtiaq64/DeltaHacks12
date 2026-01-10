"""
Render routes for final video output
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RenderRequest(BaseModel):
    video_id: str
    resolution: str = "1080p"


class RenderResponse(BaseModel):
    stream_url: str
    status: str


@router.post("/render", response_model=RenderResponse)
async def render_video(request: RenderRequest):
    """Render the final edited video"""
    # For now, we just return the stream URL from VideoDB
    # In a full implementation, this would handle complex timelines
    from services.videodb_client import get_videodb_client
    
    try:
        client = get_videodb_client()
        video = client.get_video(request.video_id)
        return RenderResponse(
            stream_url=video.stream_url,
            status="rendered"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
