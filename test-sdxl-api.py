#!/usr/bin/env python3
import requests
import json

# Test the upgraded SDXL API
try:
    response = requests.post(
        "http://localhost:7860/generate",
        json={
            "prompt": "professional portrait of Donald Trump, president",
            "num_inference_steps": 20,
            "width": 512,
            "height": 512,
            "use_refiner": False,
            "use_face_restoration": False,
            "hires_fix": False
        },
        timeout=120
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success', False)}")
        print(f"Image length: {len(data.get('image', ''))}")
        print(f"Resolution: {data.get('final_resolution', 'N/A')}")
        print(f"Face restoration: {data.get('face_restoration_applied', False)}")
        print("✅ SDXL API is working!")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
