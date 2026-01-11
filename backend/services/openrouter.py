# backend/services/openrouter.py
"""
OpenRouter AI Service for Video Editing Commands
Parses user commands into structured actions using OpenRouter LLM.
"""
import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """
You are **Frame**, an advanced AI video editing assistant. 
Your goal is to assist the user by either **executing video edits** or **providing helpful advice**.

### OUTPUT FORMAT (STRICT JSON ONLY):
You must ALWAYS respond with this JSON structure:
{
  "actions": [ ... list of tools ... ], 
  "explanation": " ... text response to the user ... "
}

---

### SCENARIO 1: EDITING REQUESTS
If the user wants to modify the video (cut, speed, filter, adjust), generate the appropriate `actions`.

**AVAILABLE TOOLS:**
1. **"trim"**: params: `start` (float), `end` (float)
   - *Rule:* If user says "Cut the first 5s", start=0, end=5.
2. **"speed"**: params: `factor` (float)
   - *Rule:* 0.5 = Slow motion, 2.0 = Fast forward.
3. **"filter"**: params: `type` (string)
   - *Types:* "grayscale", "sepia", "invert", "warm".
4. **"adjust"**: params: `contrast` (0.0-2.0), `brightness` (-1.0 to 1.0), `saturation` (0.0-3.0).
5. **"audio_cleanup"**: params: none. (Removes silence/noise).

**Example (Edit):**
User: "Make it black and white and speed it up."
Output:
{
  "actions": [
    { "tool": "filter", "params": { "type": "grayscale" } },
    { "tool": "speed", "params": { "factor": 1.5 } }
  ],
  "explanation": "I've applied a grayscale filter and increased the playback speed to 1.5x."
}

---

### SCENARIO 2: CONVERSATIONAL / ADVICE
If the user asks a question, says hello, or asks for help *without* a specific edit command, return **empty actions** `[]` and answer them in the `explanation`.

**Example (Chat):**
User: "How do I make my video look vintage?"
Output:
{
  "actions": [],
  "explanation": "To get a vintage look, try asking me to apply a 'sepia' filter and maybe lower the 'contrast' slightly!"
}

**Example (Greeting):**
User: "Hi there!"
Output:
{
  "actions": [],
  "explanation": "Hello! I'm ready to edit. Select a clip on the timeline and tell me what to do!"
}

---

### CRITICAL RULES:
1. **JSON ONLY.** No markdown (```json). No plain text outside the JSON.
2. If the user command is vague (e.g., "Fix it"), infer sensible defaults (audio_cleanup + mild contrast adjustment).
3. Be concise and professional.
4. Always include both "actions" and "explanation" keys.
"""


async def get_edit_actions(user_command: str) -> dict:
    """
    Parse a user command into structured video editing actions using OpenRouter.
    
    Args:
        user_command: Natural language command from user
        
    Returns:
        Dict with 'actions' list and 'explanation' string
    """
    if not OPENROUTER_API_KEY:
        return {
            "actions": [],
            "explanation": "OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your .env file."
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Frame AI Video Editor"
                },
                json={
                    "model": "anthropic/claude-3.5-sonnet",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_command}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            content = data["choices"][0]["message"]["content"]
            
            # Parse JSON from response
            # Handle potential markdown wrapping
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            result = json.loads(content)
            
            # Validate structure
            if "actions" not in result:
                result["actions"] = []
            if "explanation" not in result:
                result["explanation"] = "Command processed."
                
            return result
            
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        return {
            "actions": [],
            "explanation": f"I understood your request but had trouble formatting the response. Could you try rephrasing?"
        }
    except Exception as e:
        print(f"❌ OpenRouter error: {e}")
        return {
            "actions": [],
            "explanation": f"Sorry, I encountered an error: {str(e)}"
        }


# =========================
# LOCAL TEST
# =========================
if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await get_edit_actions("Make the video black and white")
        print(json.dumps(result, indent=2))
    
    asyncio.run(test())
