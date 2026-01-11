# backend/routes/voice.py
"""
Voice Command Endpoint - STT → AI Chat → TTS Response
"""
import os
import shutil
import uuid
import speech_recognition as sr
from pydub import AudioSegment
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

router = APIRouter()

TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp_storage")
os.makedirs(TEMP_DIR, exist_ok=True)


def generate_voice_reply(text: str) -> Optional[str]:
    """Generate voice reply using ElevenLabs TTS"""
    try:
        from elevenlabs.client import ElevenLabs
        
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
            print("⚠️ ELEVENLABS_API_KEY not set, skipping voice reply")
            return None
        
        client = ElevenLabs(api_key=api_key)
        
        # Generate audio
        audio_generator = client.text_to_speech.convert(
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice
            text=text,
            model_id="eleven_monolingual_v1"
        )
        
        # Save to file
        output_filename = f"voice_reply_{uuid.uuid4().hex[:8]}.mp3"
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
        
        print(f"✅ Voice reply saved: {output_filename}")
        return output_path
        
    except Exception as e:
        print(f"❌ ElevenLabs error: {e}")
        return None


@router.post("/voice-command")
async def voice_command(
    audio: UploadFile = File(...),
    video_id: Optional[str] = Form(None)
):
    """
    Process a voice command:
    1. Receive audio file
    2. Transcribe to text (Google STT)
    3. Send to AI chat
    4. Generate voice response (ElevenLabs TTS)
    """
    print("🎤 Receiving Voice Command...")

    try:
        # A. Save uploaded audio
        temp_audio_path = os.path.join(TEMP_DIR, f"temp_voice_{uuid.uuid4().hex[:8]}.webm")
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # Check file size
        file_size = os.path.getsize(temp_audio_path)
        print(f"   Audio file size: {file_size} bytes")
        
        if file_size < 1000:
            os.remove(temp_audio_path)
            return {"status": "error", "message": "Recording too short. Hold the button longer."}

        # B. Convert to WAV for SpeechRecognition
        try:
            audio_segment = AudioSegment.from_file(temp_audio_path)
            wav_path = temp_audio_path.replace(".webm", ".wav")
            audio_segment.export(wav_path, format="wav")
        except Exception as e:
            print(f"❌ Audio conversion error: {e}")
            os.remove(temp_audio_path)
            return {"status": "error", "message": "Could not process audio file."}

        # C. Transcribe to Text
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            try:
                text_command = recognizer.recognize_google(audio_data)
                print(f"🗣️ Transcribed: '{text_command}'")
            except sr.UnknownValueError:
                return {"status": "error", "message": "Could not understand audio. Please speak clearly."}
            except sr.RequestError:
                return {"status": "error", "message": "Speech recognition service unavailable."}

        # Cleanup temp files
        for path in [temp_audio_path, wav_path]:
            if os.path.exists(path):
                os.remove(path)

        # D. Send to AI Chat via HTTP
        import httpx
        
        # Build the message with video context for better AI understanding
        user_message = text_command
        if video_id:
            user_message = f"[Working on video_id: {video_id}] {text_command}"
        
        async with httpx.AsyncClient() as client:
            chat_response = await client.post(
                "http://localhost:8000/api/chat",
                json={
                    "messages": [{"role": "user", "content": user_message}],
                    "video_context": {"current_video": {"id": video_id}} if video_id else None
                },
                timeout=30.0
            )
            chat_data = chat_response.json()
        
        response_text = chat_data.get("response", "I processed your request.")
        tool_results = chat_data.get("tool_results", [])

        # E. Generate Voice Reply (ElevenLabs TTS)
        voice_reply_path = generate_voice_reply(response_text)
        voice_reply_url = None
        
        if voice_reply_path:
            voice_filename = os.path.basename(voice_reply_path)
            voice_reply_url = f"http://localhost:8000/files/{voice_filename}"

        return {
            "status": "success",
            "transcription": text_command,
            "response": response_text,
            "voice_url": voice_reply_url,
            "tool_results": tool_results
        }

    except Exception as e:
        print(f"❌ Voice Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
