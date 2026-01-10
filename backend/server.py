"""
FastAPI server for AI Video Editing Agent
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes import upload, edit, render, chat

load_dotenv()

app = FastAPI(
    title="AI Video Editor API",
    description="Backend for AI-powered video editing with VideoDB",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(edit.router, prefix="/api", tags=["edit"])
app.include_router(render.router, prefix="/api", tags=["render"])
app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
