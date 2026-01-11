"""
VideoDB client wrapper for video editing operations
"""
import os
from typing import Optional
from videodb import connect, MediaType
from videodb.timeline import Timeline
from videodb.asset import VideoAsset, TextAsset, TextStyle


class VideoDBClient:
    """Wrapper around VideoDB SDK for video editing operations"""
    
    def __init__(self):
        api_key = os.getenv("VIDEODB_API_KEY")
        if not api_key:
            raise ValueError("VIDEODB_API_KEY environment variable not set")
        self.conn = connect(api_key=api_key)
        self.collection = self.conn.get_collection()
    
    def upload_video(self, url: str, name: Optional[str] = None) -> dict:
        """Upload a video from URL"""
        video = self.collection.upload(url=url, media_type=MediaType.video, name=name)
        return {
            "id": video.id,
            "name": video.name,
            "length": video.length,
            "stream_url": video.stream_url,
            "thumbnail_url": video.thumbnail_url if hasattr(video, 'thumbnail_url') else None
        }
    
    def upload_audio(self, url: str, name: Optional[str] = None) -> dict:
        """Upload audio from URL"""
        audio = self.collection.upload(url=url, media_type=MediaType.audio, name=name)
        return {
            "id": audio.id,
            "name": audio.name,
            "length": audio.length
        }
    
    def get_video(self, video_id: str):
        """Get a video by ID"""
        return self.collection.get_video(video_id)
    
    def list_videos(self) -> list:
        """List all videos in collection"""
        videos = self.collection.get_videos()
        return [
            {
                "id": v.id,
                "name": v.name,
                "length": v.length,
                "stream_url": v.stream_url
            }
            for v in videos
        ]
    
    def create_timeline(self, video_id: str) -> dict:
        """Create a timeline from a video for editing"""
        video = self.get_video(video_id)
        timeline = Timeline(self.conn)
        
        # Add video as asset
        video_asset = VideoAsset(asset_id=video.id)
        timeline.add_inline(video_asset)
        
        return {
            "timeline_id": id(timeline),
            "video_id": video_id,
            "timeline": timeline
        }
    
    def trim_video(self, video_id: str, start: float, end: float) -> dict:
        """Trim a video to specified start and end times"""
        video = self.get_video(video_id)
        timeline = Timeline(self.conn)
        
        video_asset = VideoAsset(asset_id=video.id, start=start, end=end)
        timeline.add_inline(video_asset)
        
        stream_url = timeline.generate_stream()
        return {
            "stream_url": stream_url,
            "start": start,
            "end": end,
            "duration": end - start
        }
    
    def add_text_overlay(self, video_id: str, text: str, start: float = 0, 
                         duration: float = 5, position: str = "center",
                         video_start: float = None, video_end: float = None) -> dict:
        """Add text overlay to video while preserving any trim"""
        video = self.get_video(video_id)
        timeline = Timeline(self.conn)
        
        # Add video track - use trim if specified, otherwise full video
        if video_start is not None and video_end is not None:
            video_asset = VideoAsset(asset_id=video.id, start=video_start, end=video_end)
            actual_duration = video_end - video_start
        else:
            video_asset = VideoAsset(asset_id=video.id)
            actual_duration = video.length
            
        timeline.add_inline(video_asset)
        
        # Add text overlay
        text_asset = TextAsset(
            text=text,
            duration=min(duration, actual_duration),  # Don't exceed video duration
            style=TextStyle(
                fontsize=48,
                fontcolor="white",
                bordercolor="black",
                borderw=2
            )
        )
        timeline.add_overlay(start, text_asset)
        
        stream_url = timeline.generate_stream()
        return {
            "stream_url": stream_url,
            "text": text,
            "duration": actual_duration,
            "length": actual_duration
        }
    
    def render_video(self, timeline) -> dict:
        """Render the final video"""
        stream_url = timeline.generate_stream()
        return {
            "stream_url": stream_url,
            "status": "rendered"
        }


# Singleton instance
_client: Optional[VideoDBClient] = None


def get_videodb_client() -> VideoDBClient:
    """Get or create VideoDB client instance"""
    global _client
    if _client is None:
        _client = VideoDBClient()
    return _client
