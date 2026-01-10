"""
Chat route with AI agent for video editing
"""
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx

from services.agent_tools import get_tool_definitions
from services.videodb_client import get_videodb_client

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are an AI video editing assistant. You help users edit videos using natural language commands.

You have access to the following tools:
- upload_video: Upload a video from URL
- trim_video: Cut a video to specific timestamps (start and end in seconds)
- add_text_overlay: Add text on top of video (specify start time and duration in seconds)
- list_videos: See all videos in the project
- render_video: Export the final video

IMPORTANT RULES:
1. When the user provides a video context, use the video_id from that context.
2. If you need a video_id but don't have one, first call list_videos to see available videos.
3. For trim_video, start and end must be numbers in seconds (e.g., start=0, end=10 for first 10 seconds).
4. For add_text_overlay, start is when to begin showing text, duration is how long to show it.
5. Always confirm what action you're taking before executing.
"""


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    video_context: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[dict]] = None
    tool_results: Optional[List[dict]] = None


async def call_openrouter(messages: list, tools: list) -> dict:
    """Call OpenRouter API with tools"""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set in environment")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Video Editor"
    }
    
    payload = {
        "model": "openai/gpt-4o-mini",  # Cost-effective model with good tool support
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        "tools": tools,
        "tool_choice": "auto"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_URL,
            headers=headers,
            json=payload,
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()


async def execute_tool(tool_name: str, arguments: dict) -> dict:
    """Execute a tool and return the result"""
    try:
        client = get_videodb_client()
        
        if tool_name == "upload_video":
            return client.upload_video(arguments["url"], arguments.get("name"))
        
        elif tool_name == "trim_video":
            return client.trim_video(
                arguments["video_id"],
                arguments["start"],
                arguments["end"]
            )
        
        elif tool_name == "add_text_overlay":
            return client.add_text_overlay(
                arguments["video_id"],
                arguments["text"],
                arguments.get("start", 0),
                arguments.get("duration", 5)
            )
        
        elif tool_name == "list_videos":
            return {"videos": client.list_videos()}
        
        elif tool_name == "render_video":
            video = client.get_video(arguments["video_id"])
            return {
                "stream_url": video.stream_url,
                "status": "rendered"
            }
        
        else:
            return {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the AI video editing agent"""
    try:
        tools = get_tool_definitions()
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        # Add video context if available
        if request.video_context:
            context_msg = f"Current project context: {json.dumps(request.video_context)}"
            messages.insert(0, {"role": "system", "content": context_msg})
        
        # Call OpenRouter
        result = await call_openrouter(messages, tools)
        
        choice = result["choices"][0]
        message = choice["message"]
        
        # Check for tool calls
        if "tool_calls" in message and message["tool_calls"]:
            tool_results = []
            
            for tool_call in message["tool_calls"]:
                func = tool_call["function"]
                tool_name = func["name"]
                arguments = json.loads(func["arguments"])
                
                # Execute the tool
                tool_result = await execute_tool(tool_name, arguments)
                tool_results.append({
                    "tool": tool_name,
                    "arguments": arguments,
                    "result": tool_result
                })
            
            # Get final response after tool execution
            messages.append({"role": "assistant", "content": message.get("content", ""), "tool_calls": message["tool_calls"]})
            
            for i, tool_call in enumerate(message["tool_calls"]):
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(tool_results[i]["result"])
                })
            
            # Get final response
            final_result = await call_openrouter(messages, tools)
            final_message = final_result["choices"][0]["message"]["content"]
            
            return ChatResponse(
                response=final_message,
                tool_calls=[{"name": tc["function"]["name"], "arguments": json.loads(tc["function"]["arguments"])} for tc in message["tool_calls"]],
                tool_results=tool_results
            )
        
        return ChatResponse(response=message.get("content", ""))
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
