# backend/services/voice_gen.py
"""
ElevenLabs Text-to-Speech Integration
Generates spoken audio responses from AI text using ElevenLabs.
"""
import os
import uuid
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize ElevenLabs client
client = None
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

if ELEVENLABS_API_KEY:
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
else:
    print("⚠️ ELEVENLABS_API_KEY not found - voice responses disabled")

# Temp storage for audio files
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp_storage")
os.makedirs(TEMP_DIR, exist_ok=True)


def generate_voice_reply(text: str) -> str | None:
    """
    Generates a spoken audio response from text using ElevenLabs.
    Uses 'eleven_turbo_v2' model for low latency.
    
    Args:
        text: The text to convert to speech
        
    Returns:
        Path to the generated MP3 file, or None if failed
    """
    if not text or not client:
        return None

    try:
        print(f"🎙️ Generating Voice Reply: '{text[:50]}...'")

        # Use text_to_speech.convert() which returns a generator
        audio_stream = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",  # 'George' voice - friendly male
            model_id="eleven_turbo_v2",        # Optimized for low latency
            output_format="mp3_44100_128"      # Standard MP3 format
        )

        # Save to file
        filename = f"reply_{uuid.uuid4()}.mp3"
        filepath = os.path.join(TEMP_DIR, filename)
        
        with open(filepath, "wb") as f:
            for chunk in audio_stream:
                if chunk:
                    f.write(chunk)
        
        print(f"✅ Voice generated: {filepath}")
        return filepath

    except Exception as e:
        print(f"❌ ElevenLabs Error: {e}")
        return None


# =========================
# LOCAL TEST
# =========================
if __name__ == "__main__":
    print("Testing ElevenLabs generation...")
    path = generate_voice_reply("Hello! I am Frame, your AI video editor.")
    if path:
        print(f"Success! File saved at: {path}")
    else:
        print("Failed to generate voice.")
