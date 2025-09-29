import { NextResponse } from 'next/server'
import { mkdtemp, writeFile, readFile, unlink, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { cleanupOldTmp, cleanupTmpPrefixRecursive, Semaphore, safeUnlink } from '@/lib/server/tmp'

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
    p.stdout.on('data', d => { out += d.toString() })
    p.stderr.on('data', d => { err += d.toString() })
    p.on('close', (code) => {
      try {
        const text = out.trim()
        const parsed = text ? JSON.parse(text) : null
        if (parsed && typeof parsed === 'object') {
          resolve(parsed)
        } else {
          resolve({ ok: false, message: err || `python exited ${code}` })
        }
      } catch {
        resolve({ ok: false, message: err || `python exited ${code}` })
      }
    })
  })
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  // Preflight: aggressively clear previous ghibli-* temp to reclaim space now
  try { await cleanupTmpPrefixRecursive('ghibli-', 0) } catch {}
  // Also clear training store which may live under /tmp and grow large
  try { await rm(join(tmpdir(), 'carrot-training'), { recursive: true, force: true }) } catch {}
  await sem.acquire()
  let inputImagePath: string | null = null
  let inputDir: string | null = null
  let reqDir: string | null = null
  cleanupOldTmp(30 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})

  try {
    const fd = await req.formData()
    const prompt = (fd.get('prompt') as string) || ''
    const model = (((fd.get('model') as string) || 'animeganv3') as 'animeganv3' | 'sd-lora')
    const imageFile = fd.get('image') as unknown as File | null

    // Forward to worker for sd-lora if configured
    const workerUrl = process.env.GHIBLI_WORKER_URL || ''
    if (workerUrl && model === 'sd-lora') {
      const lora = (fd.get('lora') as string) || ''
      const loraAlpha = (fd.get('lora_alpha') as string) || ''
      const wf = new FormData()
      wf.append('prompt', prompt)
      wf.append('model', 'sd-lora')
      if (lora) wf.append('lora', lora)
      if (loraAlpha) wf.append('lora_alpha', loraAlpha)
      if (imageFile && typeof (imageFile as any).arrayBuffer === 'function') {
        wf.append('image', imageFile as any)
      }
      const workerBase = workerUrl.replace(/\/$/, '')
      const res = await fetch(workerBase + '/generate-image', { method: 'POST', body: wf })
      let data: any = null
      try { data = await res.json() } catch {}
      if (!res.ok || !data?.ok) {
        const msg = (data && (data.message || data.error)) || 'worker failed'
        if (/ENOSPC|No space left on device/i.test(String(msg))) {
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#f5f5f5'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#222'>Image generation fallback (ENOSPC)</text><text x='16' y='64' font-family='sans-serif' font-size='14' fill='#444'>Prompt:</text><foreignObject x='16' y='80' width='608' height='280'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family: sans-serif; font-size: 14px; color: #333; white-space: pre-wrap;'>${esc(prompt).slice(0,400)}</div></foreignObject></svg>`
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'ENOSPC from worker' } })
        }
        return NextResponse.json({ ok: false, status: res.status, message: msg }, { status: 500 })
      }
      const outputUrl: string | undefined = data.outputUrl || (typeof data.outputPath === 'string' ? workerBase + data.outputPath : undefined)
      return NextResponse.json({ ok: true, outputUrl, meta: data.meta || { prompt, model } })
    }

    // Local pipeline
    if (imageFile && typeof (imageFile as any).arrayBuffer === 'function') {
      const name = (imageFile as any).name as string | undefined
      const ext = (name && name.includes('.')) ? `.${name.split('.').pop()}` : '.png'
      inputImagePath = await saveBlobToTmp('input-image', imageFile as unknown as Blob, ext)
      try { inputDir = inputImagePath ? inputImagePath.substring(0, inputImagePath.lastIndexOf('/')) : null } catch {}
    }

    // Create a dedicated per-request tmp dir so cleanup is reliable
    reqDir = await mkdtemp(join(tmpdir(), 'ghibli-'))
    const outPath = join(reqDir, `out-${randomUUID()}.png`)
    const args = ['--prompt', prompt, '--model', model, '--out', outPath]
    if (inputImagePath) args.push('--input_image', inputImagePath)
    // Attempt with one retry on ENOSPC after tmp purge
    const runOnce = async () => await runPython('scripts/ghibli/image_generate.py', args)
    let result = await runOnce()
    if (!result.ok && /ENOSPC|No space left on device/i.test(String(result.message||''))) {
      try { await cleanupTmpPrefixRecursive('ghibli-', 0) } catch {}
      result = await runOnce()
    }
    if (!result.ok) {
      const msg = String(result.message || '')
      if (/ENOSPC|No space left on device/i.test(msg)) {
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#f5f5f5'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#222'>Image generation fallback (ENOSPC)</text><text x='16' y='64' font-family='sans-serif' font-size='14' fill='#444'>Prompt:</text><foreignObject x='16' y='80' width='608' height='280'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family: sans-serif; font-size: 14px; color: #333; white-space: pre-wrap;'>${esc(prompt).slice(0,400)}</div></foreignObject></svg>`
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'ENOSPC local' } })
      }
      return NextResponse.json({ ok: false, message: result.message || 'image pipeline failed' }, { status: 500 })
    }

    const finalPath = result.outputPath || outPath
    const inlinePref = (process.env.GHIBLI_INLINE_IMAGE || 'true').toLowerCase() !== 'false'
    if (inlinePref) {
      try {
        const buf = await readFile(finalPath)
        if (buf.length <= 4_000_000) {
          const base64 = buf.toString('base64')
          try { await unlink(finalPath) } catch {}
          return NextResponse.json({ ok: true, outputUrl: `data:image/png;base64,${base64}`, meta: result.meta || { prompt, model, inline: true } })
        }
      } catch {}
    }
    const publicPath = `/api/ghibli/file?path=${encodeURIComponent(finalPath)}`
    return NextResponse.json({ ok: true, outputPath: publicPath, meta: result.meta || { prompt, model } })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/ENOSPC|No space left on device/i.test(msg)) {
      const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='384'><rect width='100%' height='100%' fill='#fef2f2'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#991b1b'>Image generation failed (ENOSPC)</text></svg>`
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { fallback: 'svg', reason: 'ENOSPC throw' } })
    }
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  } finally {
    try {
      cleanupOldTmp(15 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})
      cleanupTmpPrefixRecursive('ghibli-', 2 * 60 * 1000).catch(() => {})
      // Proactively delete per-request tmp directory and uploaded input dir
      if (reqDir) { try { await rm(reqDir, { recursive: true, force: true }) } catch {} }
      if (inputDir) { try { await rm(inputDir, { recursive: true, force: true }) } catch {} }
      if (inputImagePath) { try { await safeUnlink(inputImagePath) } catch {} }
    } catch {}
    sem.release()
  }
}
