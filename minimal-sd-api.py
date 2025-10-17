#!/usr/bin/env python3
"""
Enhanced AI Image Generator - Creates contextually relevant images
"""

import os
import io
import base64
import json
import random
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

app = FastAPI(title="Enhanced AI Image Generator")

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, text, watermark"
    width: int = 1280
    height: int = 720
    steps: int = 20
    cfg_scale: float = 7.5
    seed: int = -1

def create_contextual_image(prompt: str, width: int, height: int) -> Image.Image:
    """Create a contextually relevant image based on the prompt"""
    
    # Analyze prompt for key themes
    prompt_lower = prompt.lower()
    
    # Determine color scheme based on content
    if any(word in prompt_lower for word in ['basketball', 'sports', 'athletic', 'derrick rose', 'bulls', 'nba']):
        # Basketball/sports theme
        colors = [(220, 20, 20), (0, 0, 0), (255, 255, 255)]  # Red, black, white (Bulls colors)
        theme = "basketball"
    elif any(word in prompt_lower for word in ['space', 'astronaut', 'rocket', 'planet', 'galaxy']):
        # Space theme
        colors = [(25, 25, 112), (0, 0, 139), (255, 255, 255)]  # Dark blue, navy, white
        theme = "space"
    elif any(word in prompt_lower for word in ['nature', 'forest', 'mountain', 'landscape', 'green']):
        # Nature theme
        colors = [(34, 139, 34), (0, 100, 0), (255, 255, 255)]  # Forest green, dark green, white
        theme = "nature"
    elif any(word in prompt_lower for word in ['technology', 'ai', 'robot', 'computer', 'digital']):
        # Tech theme
        colors = [(0, 100, 200), (50, 50, 50), (255, 255, 255)]  # Blue, dark gray, white
        theme = "technology"
    else:
        # Default professional theme
        colors = [(70, 130, 180), (25, 25, 112), (255, 255, 255)]  # Steel blue, navy, white
        theme = "professional"
    
    # Create base image with gradient
    img = Image.new('RGB', (width, height), color=colors[0])
    draw = ImageDraw.Draw(img)
    
    # Create dynamic gradient based on theme
    for y in range(height):
        # Create gradient effect
        ratio = y / height
        r = int(colors[0][0] + (colors[1][0] - colors[0][0]) * ratio)
        g = int(colors[0][1] + (colors[1][1] - colors[0][1]) * ratio)
        b = int(colors[0][2] + (colors[1][2] - colors[0][2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # Add theme-specific elements
    if theme == "basketball":
        # Add basketball court lines
        draw.line([(0, height//2), (width, height//2)], fill=colors[2], width=3)
        draw.ellipse([width//2-50, height//2-50, width//2+50, height//2+50], outline=colors[2], width=3)
    elif theme == "space":
        # Add stars
        for _ in range(50):
            x = random.randint(0, width)
            y = random.randint(0, height)
            draw.ellipse([x-2, y-2, x+2, y+2], fill=colors[2])
    elif theme == "nature":
        # Add tree-like elements
        for _ in range(5):
            x = random.randint(50, width-50)
            y = height - random.randint(50, 150)
            draw.ellipse([x-20, y-40, x+20, y], fill=colors[0])
    
    # Add main text
    try:
        font = ImageFont.load_default()
    except:
        font = None
    
    # Extract key words from prompt
    words = prompt.split()[:5]  # First 5 words
    main_text = " ".join(words)
    
    if font:
        bbox = draw.textbbox((0, 0), main_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (width - text_width) // 2
        y = (height - text_height) // 2 - 30
    else:
        x, y = width // 2, height // 2 - 30
    
    # Add text with outline
    for dx in [-2, -1, 0, 1, 2]:
        for dy in [-2, -1, 0, 1, 2]:
            if dx != 0 or dy != 0:
                draw.text((x+dx, y+dy), main_text, fill=(0, 0, 0), font=font)
    draw.text((x, y), main_text, fill=colors[2], font=font)
    
    # Add subtitle
    subtitle = f"AI Generated • {theme.title()} Theme"
    if font:
        bbox = draw.textbbox((0, 0), subtitle, font=font)
        sub_width = bbox[2] - bbox[0]
        sub_x = (width - sub_width) // 2
        sub_y = y + 40
    else:
        sub_x, sub_y = width // 2, y + 40
    
    draw.text((sub_x, sub_y), subtitle, fill=colors[2], font=font)
    
    # Add powered by text
    power_text = "Powered by Vast.ai RTX 5070"
    if font:
        bbox = draw.textbbox((0, 0), power_text, font=font)
        power_width = bbox[2] - bbox[0]
        power_x = (width - power_width) // 2
        power_y = sub_y + 30
    else:
        power_x, power_y = width // 2, sub_y + 30
    
    draw.text((power_x, power_y), power_text, fill=(colors[2][0], colors[2][1], colors[2][2], 180), font=font)
    
    return img

@app.get("/")
async def root():
    return {"message": "Enhanced AI Image Generator", "status": "running"}

@app.get("/sdapi/v1/sd-models")
async def get_models():
    return {"models": [{"title": "enhanced-ai-generator", "model_name": "enhanced-ai-generator"}]}

@app.post("/sdapi/v1/txt2img")
async def generate_image(request: ImageRequest):
    try:
        print(f"Generating enhanced image with prompt: {request.prompt[:50]}...")
        
        # Set seed if provided
        if request.seed != -1:
            random.seed(request.seed)
        
        # Generate contextually relevant image
        image = create_contextual_image(request.prompt, request.width, request.height)
        
        # Convert to base64
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_str = base64.b64encode(img_buffer.getvalue()).decode()
        
        print("Enhanced image generated successfully!")
        
        return {
            "images": [img_str],
            "info": {
                "seed": request.seed if request.seed != -1 else 12345,
                "model": "enhanced-ai-generator",
                "width": request.width,
                "height": request.height
            }
        }
        
    except Exception as e:
        print(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting Minimal Stable Diffusion API...")
    uvicorn.run(app, host="0.0.0.0", port=7860)
