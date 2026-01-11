"""
FFmpeg service for local audio/video merging
"""
import os
import glob
import tempfile
import subprocess
import httpx

# Find ffmpeg path - check winget installation or use PATH
def find_ffmpeg():
    # Check if in PATH first
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        if result.returncode == 0:
            return "ffmpeg"
    except:
        pass
    
    # Check winget installation paths (recursive search)
    user_home = os.path.expanduser("~")
    winget_base = os.path.join(user_home, "AppData", "Local", "Microsoft", "WinGet", "Packages")
    
    if os.path.exists(winget_base):
        for root, dirs, files in os.walk(winget_base):
            if "ffmpeg.exe" in files:
                ffmpeg_path = os.path.join(root, "ffmpeg.exe")
                print(f"[FFmpeg] Found at: {ffmpeg_path}")
                return ffmpeg_path
    
    # Check common install locations on Windows
    common_paths = [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    
    raise RuntimeError("FFmpeg not found! Install with: winget install ffmpeg")

FFMPEG_PATH = find_ffmpeg()
print(f"[FFmpeg] Using: {FFMPEG_PATH}")


def download_video_with_ffmpeg(stream_url: str, output_path: str):
    """Download video from stream URL (supports HLS/m3u8) using FFmpeg"""
    cmd = [
        FFMPEG_PATH,
        '-hide_banner',
        '-y',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-allowed_extensions', 'ALL',
        '-i', stream_url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        output_path
    ]
    
    print(f"[FFmpeg] Downloading: {stream_url[:80]}...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    
    # Check if output file was created and has content
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        error_msg = result.stderr if result.stderr else "Unknown error - no output file created"
        print(f"[FFmpeg] Download failed: {error_msg[:500]}")
        raise RuntimeError(f"Download failed: {error_msg[:300]}")
    
    print(f"[FFmpeg] Downloaded to: {output_path} ({os.path.getsize(output_path)} bytes)")


def merge_audio_video(video_path: str, audio_path: str, output_path: str) -> str:
    """Merge audio with video using FFmpeg"""
    cmd = [
        FFMPEG_PATH,
        '-hide_banner',  # Suppress version info
        '-y',
        '-i', video_path,
        '-i', audio_path,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        output_path
    ]
    
    print(f"[FFmpeg] Merging audio...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    
    # Check if output file was created
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        error_msg = result.stderr if result.stderr else "Unknown merge error"
        print(f"[FFmpeg] Merge failed: {error_msg[:200]}")
        raise RuntimeError(f"Merge failed: {error_msg[:200]}")
    
    print(f"[FFmpeg] Success! Output: {output_path} ({os.path.getsize(output_path)} bytes)")
    return output_path


async def merge_audio_with_video_stream(
    video_stream_url: str,
    audio_file_path: str,
) -> str:
    """
    Download video from stream, merge with local audio, return merged file path
    """
    # Create temp files
    video_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
    output_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
    video_temp.close()
    output_temp.close()
    
    try:
        # Download video using FFmpeg (supports HLS/m3u8)
        download_video_with_ffmpeg(video_stream_url, video_temp.name)
        
        # Merge audio
        merge_audio_video(video_temp.name, audio_file_path, output_temp.name)
        
        return output_temp.name
        
    finally:
        # Clean up video temp (keep output for serving)
        if os.path.exists(video_temp.name):
            os.unlink(video_temp.name)
