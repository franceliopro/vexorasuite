"""Download lightweight alternatives without loading them into memory."""
import json
import urllib.request

for model in ("qwen2.5:0.5b", "llama3.2:1b"):
    print("Preparing text model:", model, flush=True)
    request = urllib.request.Request(
        "http://ollama:11434/api/pull",
        data=json.dumps({"model": model, "stream": False}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=900) as response:
        result = json.load(response)
        if result.get("error") or result.get("status") != "success":
            raise RuntimeError("Text model installation was not confirmed")
        print("Text model ready:", model, flush=True)
