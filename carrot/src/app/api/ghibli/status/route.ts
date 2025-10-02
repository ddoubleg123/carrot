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
  const workerUrl = process.env.GHIBLI_WORKER_URL || process.env.INGEST_WORKER_URL || ''
  const steps = parseInt(process.env.GHIBLI_SD_STEPS || '25', 10)
  const guidance = parseFloat(process.env.GHIBLI_SD_GUIDANCE || '7.5')

  const py = await checkPythonTorch()
  const loraOk = await pathExists(lora)

  // Test worker connectivity if URL is set
  let workerStatus = 'not_configured'
  let workerHealthy = false
  let workerResponseTime: number | null = null
  let workerHealthCode: number | null = null
  let workerHealthBodySnippet: string | null = null
  let workerHealthUrl: string | null = null
  let workerFinalUrl: string | null = null
  if (workerUrl) {
    try {
      const start = Date.now()
      const healthUrl = `${workerUrl.replace(/\/$/, '')}/health`
      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      workerResponseTime = Date.now() - start
      workerStatus = res.ok ? 'healthy' : 'unhealthy'
      workerHealthy = !!res.ok
      workerHealthCode = res.status
      workerHealthUrl = healthUrl
      workerFinalUrl = res.url || healthUrl
      try {
        const text = await res.text()
        workerHealthBodySnippet = text ? text.slice(0, 200) : null
      } catch {}
    } catch {
      workerStatus = 'unreachable'
      workerHealthy = false
      workerHealthCode = null
      workerHealthBodySnippet = null
      workerHealthUrl = workerUrl ? `${workerUrl.replace(/\/$/, '')}/health` : null
      workerFinalUrl = null
    }
  }

  return NextResponse.json({
    ok: true,
    python: py.python,
    torch: py.torch,
    torchError: py.error,
    sdModel,
    loraPath: lora,
    loraExists: loraOk,
    workerUrl: workerUrl ? `${workerUrl.substring(0, 20)}...` : null, // masked for compact display
    workerUrlFull: workerUrl || null,
    workerStatus,
    workerHealthy,
    workerResponseTime,
    workerHealthCode,
    workerHealthBodySnippet,
    workerHealthUrl,
    workerFinalUrl,
    defaults: { steps, guidance },
    deviceHint: process.env.CUDA_VISIBLE_DEVICES ? 'cuda' : 'cpu'
  })
}
