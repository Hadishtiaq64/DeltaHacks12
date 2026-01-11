"""
AI Agent tool definitions for video editing
"""
from typing import Callable

# Tool definitions for the AI agent
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "upload_video",
            "description": "Upload a video from a URL to the editor",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL of the video to upload (YouTube, direct link, etc.)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Optional name for the video"
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "trim_video",
            "description": "Trim a video to specific start and end times",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "The ID of the video to trim"
                    },
                    "start": {
                        "type": "number",
                        "description": "Start time in seconds"
                    },
                    "end": {
                        "type": "number",
                        "description": "End time in seconds"
                    }
                },
                "required": ["video_id", "start", "end"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_text_overlay",
            "description": "Add text overlay on top of a video. Use video_start and video_end to preserve any existing trim.",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "The ID of the video"
                    },
                    "text": {
                        "type": "string",
                        "description": "The text to display"
                    },
                    "start": {
                        "type": "number",
                        "description": "When to start showing the text (seconds)"
                    },
                    "duration": {
                        "type": "number",
                        "description": "How long to show the text (seconds)"
                    },
                    "video_start": {
                        "type": "number",
                        "description": "If video is trimmed, the trim start time in seconds"
                    },
                    "video_end": {
                        "type": "number",
                        "description": "If video is trimmed, the trim end time in seconds"
                    }
                },
                "required": ["video_id", "text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_videos",
            "description": "List all videos currently in the project",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_video",
            "description": "Render the final video for export",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "The ID of the video to render"
                    },
                    "resolution": {
                        "type": "string",
                        "description": "Output resolution (720p, 1080p, 4k)",
                        "enum": ["720p", "1080p", "4k"]
                    }
                },
                "required": ["video_id"]
            }
        }
    }
]


def get_tool_definitions():
    """Return the tool definitions for OpenRouter"""
    return AGENT_TOOLS
