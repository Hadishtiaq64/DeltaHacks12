# backend/services/video_engine.py
"""
FFmpeg-based Video Processing Engine
Handles trim, speed, filters, adjustments, and stitching operations.
"""
import os
import uuid
import asyncio
import subprocess
import json

# Temp storage for processed files
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp_storage")
os.makedirs(TEMP_DIR, exist_ok=True)


def get_video_duration(filepath: str) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json", filepath
            ],
            capture_output=True, text=True
        )
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception as e:
        print(f"❌ ffprobe error: {e}")
        return 0.0


def has_audio_stream(filepath: str) -> bool:
    """Check if video has audio stream."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "a",
                "-show_entries", "stream=codec_type",
                "-of", "json", filepath
            ],
            capture_output=True, text=True
        )
        data = json.loads(result.stdout)
        return len(data.get("streams", [])) > 0
    except Exception:
        return False


async def process_video(
    input_path: str,
    actions: list,
    clip_start: float = 0.0,
    clip_duration: float = None
) -> dict | None:
    """
    Process video with AI-generated actions.
    
    Args:
        input_path: Path to input video
        actions: List of action dicts with 'tool' and 'params'
        clip_start: Start time for timeline trim
        clip_duration: Duration for timeline trim
        
    Returns:
        Dict with 'path' and 'duration', or None if failed
    """
    if not os.path.exists(input_path):
        print(f"❌ Input file not found: {input_path}")
        return None

    output_filename = f"processed_{uuid.uuid4()}.mp4"
    output_path = os.path.join(TEMP_DIR, output_filename)
    
    has_audio = has_audio_stream(input_path)
    
    # Build FFmpeg filter chains
    video_filters = []
    audio_filters = []
    
    # Pre-trim from timeline (razor tool cuts)
    if clip_start > 0 or clip_duration:
        # We'll handle this with -ss and -t flags instead of filters
        pass
    
    # Process each action
    for action in actions:
        tool = action.get("tool")
        params = action.get("params", {})
        print(f"⚙️ Applying: {tool} with {params}")
        
        if tool == "trim":
            # Trim is complex - we'll handle separately
            pass
            
        elif tool == "speed":
            factor = float(params.get("factor", 1.0))
            if factor != 1.0:
                video_filters.append(f"setpts={1/factor}*PTS")
                if has_audio:
                    # atempo only accepts 0.5-2.0, so chain for extreme values
                    current = factor
                    atempo_chain = []
                    while current > 2.0:
                        atempo_chain.append("atempo=2.0")
                        current /= 2.0
                    while current < 0.5:
                        atempo_chain.append("atempo=0.5")
                        current *= 2.0
                    atempo_chain.append(f"atempo={current}")
                    audio_filters.extend(atempo_chain)
                    
        elif tool == "filter":
            filter_type = params.get("type", "").lower()
            if filter_type == "grayscale":
                video_filters.append("hue=s=0")
            elif filter_type == "sepia":
                video_filters.append(
                    "colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:"
                    "gr=0.349:gg=0.686:gb=0.168:br=0.272:bg=0.534:bb=0.131"
                )
            elif filter_type == "invert":
                video_filters.append("negate")
            elif filter_type == "warm":
                video_filters.append("eq=saturation=1.2:contrast=1.1")
                
        elif tool == "adjust":
            contrast = params.get("contrast", 1.0)
            brightness = params.get("brightness", 0.0)
            saturation = params.get("saturation", 1.0)
            video_filters.append(
                f"eq=contrast={contrast}:brightness={brightness}:saturation={saturation}"
            )
            
        elif tool == "audio_cleanup":
            if has_audio:
                # Remove silence and normalize
                audio_filters.append("silenceremove=1:0:-50dB")
                audio_filters.append("loudnorm")

    # Build FFmpeg command
    cmd = ["ffmpeg", "-y", "-i", input_path]
    
    # Add seek/duration for timeline trim
    if clip_start > 0:
        cmd.extend(["-ss", str(clip_start)])
    if clip_duration:
        cmd.extend(["-t", str(clip_duration)])
    
    # Add filters
    filter_complex = []
    if video_filters:
        filter_complex.append(",".join(video_filters))
    
    if filter_complex:
        cmd.extend(["-vf", ",".join(filter_complex)])
    
    if audio_filters and has_audio:
        cmd.extend(["-af", ",".join(audio_filters)])
    elif not has_audio:
        cmd.extend(["-an"])
    
    # Output settings
    cmd.extend([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac" if has_audio else "copy",
        output_path
    ])
    
    try:
        print(f"🎬 Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ FFmpeg error: {result.stderr}")
            return None
            
        duration = get_video_duration(output_path)
        print(f"✅ Processed: {output_path} ({duration:.2f}s)")
        
        return {"path": output_path, "duration": duration}
        
    except Exception as e:
        print(f"❌ Processing error: {e}")
        return None


async def stitch_videos(clips: list) -> str | None:
    """
    Concatenate multiple clips into a single video.
    
    Args:
        clips: List of dicts with 'url' and optional 'start'/'duration'
        
    Returns:
        Path to stitched video, or None if failed
    """
    if not clips:
        return None
        
    output_filename = f"rendered_{uuid.uuid4()}.mp4"
    output_path = os.path.join(TEMP_DIR, output_filename)
    
    # Create concat file
    concat_file = os.path.join(TEMP_DIR, f"concat_{uuid.uuid4()}.txt")
    
    try:
        with open(concat_file, "w") as f:
            for clip in clips:
                # Extract filename from URL or path
                url = clip.get("url", "")
                if url.startswith("http://localhost:8000/files/"):
                    filename = url.replace("http://localhost:8000/files/", "")
                    filepath = os.path.join(TEMP_DIR, filename)
                else:
                    filepath = url
                    
                if os.path.exists(filepath):
                    f.write(f"file '{filepath}'\n")
        
        # Run concat
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Cleanup
        os.remove(concat_file)
        
        if result.returncode != 0:
            print(f"❌ Stitch error: {result.stderr}")
            return None
            
        print(f"✅ Stitched: {output_path}")
        return output_path
        
    except Exception as e:
        print(f"❌ Stitch error: {e}")
        return None


# =========================
# LOCAL TEST
# =========================
if __name__ == "__main__":
    import asyncio
    
    async def test():
        # Test with a sample video
        result = await process_video(
            "test.mp4",
            [{"tool": "filter", "params": {"type": "grayscale"}}]
        )
        print(f"Result: {result}")
    
    asyncio.run(test())
