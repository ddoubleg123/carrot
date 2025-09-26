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
  const steps = parseInt(process.env.GHIBLI_SD_STEPS || '25', 10)
  const guidance = parseFloat(process.env.GHIBLI_SD_GUIDANCE || '7.5')

  const py = await checkPythonTorch()
  const loraOk = await pathExists(lora)

  return NextResponse.json({
    ok: true,
    python: py.python,
    torch: py.torch,
    torchError: py.error,
    sdModel,
    loraPath: lora,
    loraExists: loraOk,
    defaults: { steps, guidance },
    deviceHint: process.env.CUDA_VISIBLE_DEVICES ? 'cuda' : 'cpu'
  })
}
