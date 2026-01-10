# AI Video Editing Agent

An AI-powered video editor with natural language commands. Built with Next.js, FastAPI, and VideoDB.

## Features

- 🎬 **Video Upload** - Upload videos from URLs
- ✂️ **Trim & Cut** - Trim videos via AI commands
- 📝 **Text Overlays** - Add text to videos
- 🤖 **AI Agent** - Natural language video editing
- 🎨 **Modern UI** - Dark theme with timeline view

## Quick Start

### 1. Clone and Setup

```bash
cd DeltaHacks12
```

### 2. Get API Keys

- **VideoDB**: Get free API key at https://console.videodb.io ($20 free credit)
- **OpenRouter**: Get API key at https://openrouter.ai

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your keys
copy .env.example .env
# Edit .env with your API keys

# Run backend
python server.py
```

Backend runs at: http://localhost:8000

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run frontend
npm run dev
```

Frontend runs at: http://localhost:3000

## Usage

1. Open http://localhost:3000
2. Chat with the AI to upload videos:
   - "Upload this video: https://example.com/video.mp4"
3. Edit with natural language:
   - "Trim the video to the first 10 seconds"
   - "Add text 'Hello World' at the beginning"
4. Export your final video:
   - "Render the video"

## Tech Stack

- **Frontend**: Next.js, TypeScript, React
- **Backend**: FastAPI, Python
- **Video Processing**: VideoDB SDK
- **AI**: OpenRouter (GPT-4o-mini)
