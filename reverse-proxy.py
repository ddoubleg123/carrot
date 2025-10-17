#!/usr/bin/env python3
"""
Reverse proxy to expose Vast.ai API through SSH tunnel
"""
import asyncio
import aiohttp
from aiohttp import web
import json

async def proxy_handler(request):
    """Proxy requests to the internal API"""
    try:
        # Forward to the internal API
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'http://localhost:8080/sdapi/v1/txt2img',
                json=await request.json(),
                timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                data = await resp.json()
                return web.json_response(data)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

async def health_handler(request):
    """Health check endpoint"""
    return web.json_response({'status': 'running', 'proxy': 'active'})

def create_app():
    app = web.Application()
    app.router.add_post('/sdapi/v1/txt2img', proxy_handler)
    app.router.add_get('/health', health_handler)
    app.router.add_get('/', health_handler)
    return app

if __name__ == '__main__':
    print("🚀 Starting reverse proxy on port 8080...")
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=8080)
