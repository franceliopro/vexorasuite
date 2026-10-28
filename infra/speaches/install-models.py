"""Install the configured speech models through Speaches' idempotent model API."""
import urllib.request

base = "http://speaches:8000/v1/models/"
for model in ("Systran/faster-whisper-tiny", "Systran/faster-whisper-base", "Systran/faster-whisper-small", "speaches-ai/Kokoro-82M-v1.0-ONNX", "speaches-ai/piper-pt_BR-edresson-low", "speaches-ai/piper-pt_BR-faber-medium"):
    print("Preparing speech model:", model, flush=True)
    request = urllib.request.Request(base + model, method="POST")
    with urllib.request.urlopen(request, timeout=900) as response:
        if response.status not in (200, 201):
            raise RuntimeError("Speech model installation failed")
        print("Speech model ready:", model, flush=True)
