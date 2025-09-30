#!/usr/bin/env python3
"""
Cleanup endpoint for Vast.ai Ghibli worker
Add this to your Vast.ai worker to handle automatic disk cleanup
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

def cleanup_disk_space():
    """Clean up disk space on the Vast.ai worker"""
    cleanup_results = {
        "cleaned_files": 0,
        "freed_space_mb": 0,
        "errors": []
    }
    
    try:
        # 1. Clean temporary files
        temp_dirs = ['/tmp', '/var/tmp']
        for temp_dir in temp_dirs:
            if os.path.exists(temp_dir):
                for item in os.listdir(temp_dir):
                    item_path = os.path.join(temp_dir, item)
                    try:
                        if os.path.isfile(item_path):
                            size = os.path.getsize(item_path)
                            os.remove(item_path)
                            cleanup_results["cleaned_files"] += 1
                            cleanup_results["freed_space_mb"] += size / (1024 * 1024)
                        elif os.path.isdir(item_path) and item.startswith(('ghibli-', 'generated_', 'tmp_')):
                            size = get_dir_size(item_path)
                            shutil.rmtree(item_path)
                            cleanup_results["cleaned_files"] += 1
                            cleanup_results["freed_space_mb"] += size / (1024 * 1024)
                    except Exception as e:
                        cleanup_results["errors"].append(f"Failed to clean {item_path}: {str(e)}")
        
        # 2. Clean Python cache
        try:
            result = subprocess.run(['find', '.', '-name', '__pycache__', '-type', 'd', '-exec', 'rm', '-rf', '{}', '+'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                cleanup_results["cleaned_files"] += 1
        except Exception as e:
            cleanup_results["errors"].append(f"Failed to clean Python cache: {str(e)}")
        
        # 3. Clean pip cache
        try:
            result = subprocess.run(['pip', 'cache', 'purge'], capture_output=True, text=True)
            if result.returncode == 0:
                cleanup_results["cleaned_files"] += 1
        except Exception as e:
            cleanup_results["errors"].append(f"Failed to clean pip cache: {str(e)}")
        
        # 4. Clean old generated images (keep only last 10)
        output_dir = Path('./outputs')
        if output_dir.exists():
            image_files = list(output_dir.glob('*.png')) + list(output_dir.glob('*.jpg'))
            if len(image_files) > 10:
                # Sort by modification time, keep newest 10
                image_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
                for old_file in image_files[10:]:
                    try:
                        size = old_file.stat().st_size
                        old_file.unlink()
                        cleanup_results["cleaned_files"] += 1
                        cleanup_results["freed_space_mb"] += size / (1024 * 1024)
                    except Exception as e:
                        cleanup_results["errors"].append(f"Failed to clean {old_file}: {str(e)}")
        
        # 5. Get current disk usage
        try:
            result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
            cleanup_results["disk_usage"] = result.stdout.strip()
        except Exception as e:
            cleanup_results["errors"].append(f"Failed to get disk usage: {str(e)}")
            
    except Exception as e:
        cleanup_results["errors"].append(f"General cleanup error: {str(e)}")
    
    return cleanup_results

def get_dir_size(path):
    """Get directory size in bytes"""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    total += os.path.getsize(filepath)
                except (OSError, FileNotFoundError):
                    pass
    except Exception:
        pass
    return total

# If running as FastAPI endpoint, add this to your worker:
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/cleanup")
async def cleanup_endpoint():
    try:
        result = cleanup_disk_space()
        return JSONResponse(content={
            "ok": True,
            "message": f"Cleaned {result['cleaned_files']} items, freed {result['freed_space_mb']:.1f}MB",
            "details": result
        })
    except Exception as e:
        return JSONResponse(content={
            "ok": False,
            "message": f"Cleanup failed: {str(e)}"
        }, status_code=500)
"""
