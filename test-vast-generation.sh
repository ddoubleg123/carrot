#!/bin/bash
# Test real Stable Diffusion image generation

echo "Testing Stable Diffusion image generation..."
response=$(curl -s -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a professional basketball player",
    "num_inference_steps": 20,
    "guidance_scale": 7.5
  }')

# Check if we got an image back
if echo "$response" | grep -q "data:image/png;base64"; then
    echo "✅ SUCCESS! Real AI image generated!"
    echo "Response contains base64 image data"
    # Show first 200 chars of response
    echo "$response" | head -c 200
    echo "..."
else
    echo "❌ FAILED! No image generated"
    echo "Response: $response"
fi

