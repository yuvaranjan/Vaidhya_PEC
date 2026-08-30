import asyncio
import os
import httpx
import base64

SARVAM_API_KEY = "sk_13go2tse_Sv6pXZ106xVjPMfmgMmGYpDa"

async def main():
    print("Testing Sarvam API Integration...\n")
    
    # 1. Test Text-to-Speech (TTS)
    print("--- 1. Testing Text-to-Speech (TTS) ---")
    
    test_text = "नमस्ते, मैं वैद्य हूँ। मैं आपकी कैसे मदद कर सकती हूँ?"
    test_lang = "hi-IN"
    
    print(f"Generating audio for text: '{test_text}'")
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    
    data = {
        "text": test_text,
        "language_code": test_lang,
        "model": "bulbul:v3",
        "speaker": "priya"
    }
    
    audio_file_path = "test_audio.wav"
    
    async with httpx.AsyncClient() as client:
        try:
            print("Sending request to Sarvam TTS API...")
            response = await client.post("https://api.sarvam.ai/text-to-speech", headers=headers, json=data, timeout=15.0)
            response.raise_for_status()
            
            resp_json = response.json()
            audios = resp_json.get("audios", [])
            if not audios:
                print("No audio returned.")
                return
            
            audio_data = base64.b64decode(audios[0])
            with open(audio_file_path, "wb") as f:
                f.write(audio_data)
                
            print(f"TTS Success! Audio saved to: {os.path.abspath(audio_file_path)}")
        except httpx.HTTPStatusError as e:
            print(f"TTS Request failed: {e}")
            print(f"Error details: {e.response.text}")
            return
        except Exception as e:
            print(f"TTS Request failed: {e}")
            return
            
    # 2. Test Speech-to-Text (STT)
    print("\n--- 2. Testing Speech-to-Text (STT) ---")
    print(f"Reading generated audio file: {audio_file_path}")
    
    headers_stt = {"api-subscription-key": SARVAM_API_KEY}
    
    with open(audio_file_path, "rb") as f:
        audio_bytes = f.read()
        
    print("Sending audio to Sarvam STT (transcribe & translate)...")
    
    async with httpx.AsyncClient() as client:
        try:
            # 1. Native transcription
            files_native = {"file": ("audio.wav", audio_bytes, "audio/wav")}
            data_native = {"model": "saaras:v3", "language_code": test_lang, "mode": "transcribe"}
            req_native = client.post("https://api.sarvam.ai/speech-to-text", headers=headers_stt, data=data_native, files=files_native, timeout=30.0)
            
            # 2. English translation
            files_english = {"file": ("audio.wav", audio_bytes, "audio/wav")}
            data_english = {"model": "saaras:v3", "language_code": test_lang, "mode": "translate"}
            req_english = client.post("https://api.sarvam.ai/speech-to-text", headers=headers_stt, data=data_english, files=files_english, timeout=30.0)
            
            resp_native, resp_english = await asyncio.gather(req_native, req_english)
            
            resp_native.raise_for_status()
            resp_english.raise_for_status()
            
            native_text = resp_native.json().get("transcript", "")
            english_text = resp_english.json().get("transcript", "")
            
            print("\nSTT Results:")
            print(f"- Native Transcript: {native_text}")
            print(f"- English Translation: {english_text}")
        except Exception as e:
            print(f"STT Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
