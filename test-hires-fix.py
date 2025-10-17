#!/usr/bin/env python3
"""
Test script for the new Hires Fix feature in upgraded-sdxl-api.py

This demonstrates the two-pass upscaling technique:
1. Generate base image at 768x768
2. Upscale to 1536x1536 using LANCZOS
3. Re-denoise with refiner at strength 0.35

Usage:
  python test-hires-fix.py
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import time

API_URL = "http://localhost:7860"

def test_health():
    """Test if the API is healthy"""
    print("🔍 Checking API health...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=10)
        health = response.json()
        print(f"✅ API Status: {health['status']}")
        print(f"   Models Loaded: {health['model_loaded']}")
        print(f"   CUDA Available: {health['cuda_available']}")
        print(f"   CodeFormer: {health['codeformer_available']}")
        print(f"   RealESRGAN: {health.get('realesrgan_available', False)}")
        print(f"   VRAM: {health['vram_available']}")
        return health['model_loaded']
    except Exception as e:
        print(f"❌ API health check failed: {e}")
        return False

def test_standard_generation():
    """Test standard generation (no hires fix)"""
    print("\n📸 Testing Standard Generation (1024x1024)...")
    
    payload = {
        "prompt": "a professional photo of a red sports car, highly detailed, sharp focus",
        "num_inference_steps": 25,
        "guidance_scale": 7.5,
        "width": 1024,
        "height": 1024,
        "use_refiner": True,
        "hires_fix": False,
        "seed": 42  # For reproducibility
    }
    
    start = time.time()
    try:
        response = requests.post(f"{API_URL}/generate", json=payload, timeout=120)
        result = response.json()
        elapsed = time.time() - start
        
        print(f"✅ Generation completed in {elapsed:.1f}s")
        print(f"   Resolution: {result['final_resolution']}")
        print(f"   Refiner Applied: {result['refiner_applied']}")
        print(f"   Hires Fix Applied: {result['hires_fix_applied']}")
        
        # Save image
        save_image(result['image'], "output_standard.png")
        return True
        
    except Exception as e:
        print(f"❌ Standard generation failed: {e}")
        return False

def test_hires_fix():
    """Test advanced hires fix (two-pass generation)"""
    print("\n🚀 Testing Advanced Hires Fix (768→1536)...")
    
    payload = {
        "prompt": "a professional photo of a red sports car, highly detailed, sharp focus",
        "num_inference_steps": 30,  # More steps for better quality
        "guidance_scale": 7.5,
        "hires_fix": True,  # Enable advanced hires fix
        "use_refiner": False,  # Not needed, hires_fix uses refiner internally
        "seed": 42  # Same seed for comparison
    }
    
    start = time.time()
    try:
        response = requests.post(f"{API_URL}/generate", json=payload, timeout=180)
        result = response.json()
        elapsed = time.time() - start
        
        print(f"✅ Hires Fix generation completed in {elapsed:.1f}s")
        print(f"   Final Resolution: {result['final_resolution']}")
        print(f"   Refiner Applied: {result['refiner_applied']}")
        print(f"   Hires Fix Applied: {result['hires_fix_applied']}")
        
        # Save image
        save_image(result['image'], "output_hires_fix.png")
        return True
        
    except Exception as e:
        print(f"❌ Hires fix generation failed: {e}")
        return False

def test_simple_hires_fix():
    """Test simple hires fix (legacy upscaling)"""
    print("\n📏 Testing Simple Hires Fix (legacy upscaling)...")
    
    payload = {
        "prompt": "a professional photo of a red sports car, highly detailed, sharp focus",
        "num_inference_steps": 25,
        "guidance_scale": 7.5,
        "width": 768,
        "height": 768,
        "use_refiner": True,
        "hires_fix_simple": True,  # Enable simple hires fix
        "hires_scale": 1.5,  # 768 * 1.5 = 1152
        "seed": 42
    }
    
    start = time.time()
    try:
        response = requests.post(f"{API_URL}/generate", json=payload, timeout=120)
        result = response.json()
        elapsed = time.time() - start
        
        print(f"✅ Simple hires fix completed in {elapsed:.1f}s")
        print(f"   Final Resolution: {result['final_resolution']}")
        print(f"   Hires Fix Applied: {result['hires_fix_applied']}")
        
        # Save image
        save_image(result['image'], "output_simple_hires.png")
        return True
        
    except Exception as e:
        print(f"❌ Simple hires fix failed: {e}")
        return False

def test_face_restoration():
    """Test CodeFormer face restoration"""
    print("\n👤 Testing CodeFormer Face Restoration...")
    
    payload = {
        "prompt": "professional portrait photo of a person, detailed face, sharp eyes, natural skin, high quality, 8k",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "width": 1024,
        "height": 1024,
        "use_refiner": True,
        "use_face_restoration": True,  # Enable face restoration
        "face_restoration_weight": 0.6,  # Balance between quality and fidelity
        "seed": 123
    }
    
    start = time.time()
    try:
        response = requests.post(f"{API_URL}/generate", json=payload, timeout=180)
        result = response.json()
        elapsed = time.time() - start
        
        print(f"✅ Face restoration test completed in {elapsed:.1f}s")
        print(f"   Resolution: {result['final_resolution']}")
        print(f"   Face Restoration Applied: {result.get('face_restoration_applied', False)}")
        
        # Save image
        save_image(result['image'], "output_face_restoration.png")
        return True
        
    except Exception as e:
        print(f"❌ Face restoration test failed: {e}")
        return False

def test_hires_fix_with_face_restoration():
    """Test Hires Fix + Face Restoration combined"""
    print("\n🌟 Testing Hires Fix + Face Restoration (Best Quality)...")
    
    payload = {
        "prompt": "professional headshot portrait, detailed facial features, sharp eyes, natural skin texture, professional photography, 8k",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "hires_fix": True,  # Enable hires fix
        "use_face_restoration": True,  # Enable face restoration
        "face_restoration_weight": 0.6,
        "seed": 123
    }
    
    start = time.time()
    try:
        response = requests.post(f"{API_URL}/generate", json=payload, timeout=180)
        result = response.json()
        elapsed = time.time() - start
        
        print(f"✅ Combined test completed in {elapsed:.1f}s")
        print(f"   Resolution: {result['final_resolution']}")
        print(f"   Hires Fix Applied: {result['hires_fix_applied']}")
        print(f"   Face Restoration Applied: {result.get('face_restoration_applied', False)}")
        
        # Save image
        save_image(result['image'], "output_best_quality.png")
        return True
        
    except Exception as e:
        print(f"❌ Combined test failed: {e}")
        return False

def save_image(data_uri: str, filename: str):
    """Save base64 image to file"""
    try:
        # Extract base64 data
        image_data = data_uri.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        
        # Convert to PIL and save
        image = Image.open(BytesIO(image_bytes))
        image.save(filename)
        print(f"   💾 Saved to {filename}")
        
    except Exception as e:
        print(f"   ⚠️  Failed to save image: {e}")

def main():
    print("=" * 60)
    print("SDXL Hires Fix Test Suite")
    print("=" * 60)
    
    # Check API health
    if not test_health():
        print("\n❌ API is not healthy. Please start the service first.")
        print("   Run: python upgraded-sdxl-api.py")
        return
    
    print("\n" + "=" * 60)
    print("Running Tests")
    print("=" * 60)
    
    # Run tests
    results = []
    results.append(("Standard Generation", test_standard_generation()))
    results.append(("Advanced Hires Fix", test_hires_fix()))
    results.append(("Simple Hires Fix", test_simple_hires_fix()))
    results.append(("Face Restoration", test_face_restoration()))
    results.append(("Hires Fix + Face Restoration", test_hires_fix_with_face_restoration()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    passed_count = sum(1 for _, p in results if p)
    print(f"\n{passed_count}/{len(results)} tests passed")
    
    print("\n" + "=" * 60)
    print("Comparison Guide")
    print("=" * 60)
    print("📁 Output files:")
    print("   • output_standard.png            - Standard 1024x1024 generation")
    print("   • output_hires_fix.png           - Advanced 1536x1536 (two-pass)")
    print("   • output_simple_hires.png        - Simple 1152x1152 (upscaled)")
    print("   • output_face_restoration.png    - 1024x1024 with face restoration")
    print("   • output_best_quality.png        - 1536x1536 with all enhancements ⭐")
    print("\n💡 Compare the images to see the quality difference!")
    print("   The advanced hires fix should show much more detail.")
    print("   Face restoration should show sharper facial features.")
    print("   Best quality combines both for maximum realism.")

if __name__ == "__main__":
    main()

