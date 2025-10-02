import { NextResponse } from 'next/server'
import { access } from 'fs/promises'
import { constants } from 'fs'
import { spawn } from 'child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkPythonTorch(): Promise<{ python: boolean; torch: boolean; error?: string }>{
  return new Promise((resolve) => {
    try {
      const p = spawn('python', ['-c', 'import sys; print("py", sys.version); import importlib; print("torch", bool(importlib.util.find_spec("torch")))'], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      let err = ''
      p.stdout.on('data', d => out += d.toString())
      p.stderr.on('data', d => err += d.toString())
      p.on('close', () => {
        const hasPy = /py\s+/.test(out)
        const hasTorch = /torch\s+True/.test(out)
        resolve({ python: hasPy, torch: hasTorch, error: err.trim() || undefined })
      })
    } catch (e: any) {
      resolve({ python: false, torch: false, error: e?.message })
    }
  })
}

async function pathExists(p?: string | null) {
  if (!p) return false
  try {
    await access(p, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const sdModel = process.env.GHIBLI_SD_MODEL || 'runwayml/stable-diffusion-v1-5'
  const lora = process.env.GHIBLI_LORA_WEIGHTS || ''
  const workerUrl = process.env.INGEST_WORKER_URL || process.env.GHIBLI_WORKER_URL || ''
  const steps = parseInt(process.env.GHIBLI_SD_STEPS || '25', 10)
  const guidance = parseFloat(process.env.GHIBLI_SD_GUIDANCE || '7.5')

  const py = await checkPythonTorch()
  const loraOk = await pathExists(lora)

  // Test worker connectivity if URL is set
  let workerStatus = 'not_configured'
  let workerError = null
  let workerResponseTime = null
  
  if (workerUrl) {
    const startTime = Date.now()
    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      workerResponseTime = Date.now() - startTime
      
      if (response.ok) {
        workerStatus = 'healthy'
      } else {
        workerStatus = 'unhealthy'
        workerError = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (e: any) {
      workerResponseTime = Date.now() - startTime
      workerStatus = 'unreachable'
      workerError = e.message || 'Connection failed'
    }
  }

  // Determine overall system status
  const canGenerateImages = workerStatus === 'healthy' || (py.torch && loraOk)
  const fallbackMode = workerStatus !== 'healthy' && !py.torch

  return NextResponse.json({
    ok: true,
    python: py.python,
    torch: py.torch,
    torchError: py.error,
    sdModel,
    loraPath: lora,
    loraExists: loraOk,
    workerUrl: workerUrl ? `${workerUrl.substring(0, 20)}...` : null, // Only show first 20 chars for security
    workerStatus,
    workerError,
    workerResponseTime,
    canGenerateImages,
    fallbackMode,
    defaults: { steps, guidance },
    deviceHint: process.env.CUDA_VISIBLE_DEVICES ? 'cuda' : 'cpu',
    recommendations: {
      ...(workerStatus === 'unreachable' && { 
        worker: 'GPU worker is unreachable. Check Vast.ai instance and tunnel.' 
      }),
      ...(workerStatus === 'unhealthy' && { 
        worker: 'GPU worker is responding but unhealthy. Check worker logs.' 
      }),
      ...(!py.torch && { 
        local: 'Local SD generation unavailable. Install torch or use GPU worker.' 
      }),
      ...(!loraOk && lora && { 
        lora: 'LoRA weights file not found. Check GHIBLI_LORA_WEIGHTS path.' 
      })
    }
  })
}
