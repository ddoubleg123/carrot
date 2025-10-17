#!/usr/bin/env python3
import requests
import json

# Test the Stable Diffusion API
try:
    response = requests.post(
        "http://localhost:7860/generate",
        json={
            "prompt": "basketball player",
            "num_inference_steps": 20
        },
        timeout=60
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        if "image" in data:
            print("✅ SUCCESS! Generated real AI image!")
            print(f"Image data length: {len(data['image'])}")
        else:
            print("❌ No image in response")
            print(response.text[:500])
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
