import { NextResponse } from 'next/server'
import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { cleanupOldTmp, Semaphore, safeUnlink } from '@/lib/server/tmp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.GHIBLI_MAX_CONCURRENCY || '1', 10) || 1)
const sem = new Semaphore(MAX_CONCURRENCY)

async function saveBlobToTmp(prefix: string, blob: Blob, ext: string) {
  const dir = await mkdtemp(join(tmpdir(), 'ghibli-'))
  const filePath = join(dir, `${prefix}-${randomUUID()}${ext}`)
  const buf = Buffer.from(await blob.arrayBuffer())
  await writeFile(filePath, buf)
  return filePath
}

function runPython(scriptPath: string, args: string[]): Promise<{ ok: boolean; meta?: any; outputPath?: string; message?: string }>{
  return new Promise((resolve) => {
    const p = spawn('python', [scriptPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    p.stdout.on('data', d => out += d.toString())
    p.stderr.on('data', d => err += d.toString())
    p.on('close', (code) => {
      try {
        const parsed = JSON.parse(out.trim())
        resolve(parsed)
      } catch {
        resolve({ ok: false, message: err || `python exited ${code}` })
      }
    })
  })
}

export async function POST(req: Request) {
  try {
    // Opportunistic temp cleanup (30 min old)
    cleanupOldTmp(30 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})

    await sem.acquire()
    const fd = await req.formData()
    const prompt = (fd.get('prompt') as string) || ''
    const model = ((fd.get('model') as string) || 'animeganv3') as 'animeganv3' | 'sd-lora'
    const imageFile = fd.get('image') as unknown as File | null
    let inputImagePath = ''

    // If configured, forward sd-lora jobs to a remote GPU worker (FastAPI)
    const workerUrl = process.env.GHIBLI_WORKER_URL || ''
    if (workerUrl && model === 'sd-lora') {
      const lora = (fd.get('lora') as string) || ''
      const loraAlpha = (fd.get('lora_alpha') as string) || ''
      // Always send multipart form-data since worker expects Form(...) fields
      const wf = new FormData()
      wf.append('prompt', prompt)
      wf.append('model', 'sd-lora')
      if (lora) wf.append('lora', lora)
      if (loraAlpha) wf.append('lora_alpha', loraAlpha)
      if (imageFile && typeof imageFile.arrayBuffer === 'function') {
        wf.append('image', imageFile as any)
      }
      const workerBase = workerUrl.replace(/\/$/, '')
      const res = await fetch(workerBase + '/generate-image', { method: 'POST', body: wf })
      let data: any = null
      try { data = await res.json() } catch {}
      if (!res.ok || !data?.ok) {
        const msg = (data && (data.message || data.error)) || 'worker failed'
        // Graceful fallback for ENOSPC/No space left on device: return a tiny SVG data URL so UI can still render
        if (/ENOSPC|No space left on device/i.test(String(msg))) {
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#f5f5f5'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#222'>Image generation fallback (ENOSPC)</text><text x='16' y='64' font-family='sans-serif' font-size='14' fill='#444'>Prompt:</text><foreignObject x='16' y='80' width='608' height='280'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family: sans-serif; font-size: 14px; color: #333; white-space: pre-wrap;'>${esc(prompt).slice(0,400)}</div></foreignObject></svg>`
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'ENOSPC from worker' } })
        }
        return NextResponse.json({ ok: false, status: res.status, message: msg }, { status: 500 })
      }
      // Normalize output: prefer absolute outputUrl; if worker returned a relative outputPath, rewrite to absolute using GHIBLI_WORKER_URL
      let outputUrl: string | undefined = data.outputUrl
      if (!outputUrl && typeof data.outputPath === 'string') {
        outputUrl = workerBase + data.outputPath
      }
      return NextResponse.json({ ok: true, outputUrl, meta: data.meta || { prompt, model } })
    }

    if (imageFile && typeof imageFile.arrayBuffer === 'function') {
      const ext = (imageFile.name && imageFile.name.includes('.')) ? `.${imageFile.name.split('.').pop()}` : '.png'
      inputImagePath = await saveBlobToTmp('input-image', imageFile as unknown as Blob, ext)
    }

    const outPath = join(tmpdir(), `ghibli-out-${randomUUID()}.png`)

    const args = [
      '--prompt', prompt,
      '--model', model,
      '--out', outPath,
    ]
    if (inputImagePath) { args.push('--input_image', inputImagePath) }

    const result = await runPython('scripts/ghibli/image_generate.py', args)
    if (!result.ok) {
      const msg = String(result.message || '')
      if (/ENOSPC|No space left on device/i.test(msg)) {
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#f5f5f5'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#222'>Image generation fallback (ENOSPC)</text><text x='16' y='64' font-family='sans-serif' font-size='14' fill='#444'>Prompt:</text><foreignObject x='16' y='80' width='608' height='280'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family: sans-serif; font-size: 14px; color: #333; white-space: pre-wrap;'>${esc(prompt).slice(0,400)}</div></foreignObject></svg>`
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'ENOSPC local' } })
      }
      return NextResponse.json({ ok: false, message: result.message || 'image pipeline failed' }, { status: 500 })
    }

    const publicPath = `/api/ghibli/file?path=${encodeURIComponent(result.outputPath || outPath)}`
    return NextResponse.json({ ok: true, outputPath: publicPath, meta: result.meta || { prompt, model } })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/ENOSPC|No space left on device/i.test(msg)) {
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#fef2f2'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#991b1b'>Image generation failed (ENOSPC)</text></svg>`
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { fallback: 'svg', reason: 'ENOSPC throw' } })
    }
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  } finally {
    // Best-effort cleanup of any leaked input temp file
    try {
      // inputImagePath may be defined in scope if saveBlobToTmp executed
      // no-op here as it's block-scoped; just attempt pattern cleanup
      cleanupOldTmp(15 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})
    } catch {}
    sem.release()
  }
}
