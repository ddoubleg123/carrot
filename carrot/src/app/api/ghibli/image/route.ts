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
  // IMPORTANT: Do NOT clear the training store; it persists AI agent assessments.
  // If you need to reclaim space, only clear ghibli-* temp dirs via cleanupTmpPrefixRecursive.
  await sem.acquire()
  let inputImagePath: string | null = null
  let inputDir: string | null = null
  let reqDir: string | null = null
  cleanupOldTmp(30 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})

  try {
    const fd = await req.formData()
    const prompt = (fd.get('prompt') as string) || ''
    let model = (((fd.get('model') as string) || '') as 'animeganv3' | 'sd-lora' | '')
    const imageFile = fd.get('image') as unknown as File | null

    // Choose sensible defaults and validation to avoid heavy/invalid runs:
    // - If no image: we must use text→image (sd-lora). AnimeGAN requires an input image.
    // - If image present and model unspecified: default to animeganv3 (style transfer).
    if (!imageFile) {
      if (!model) model = 'sd-lora'
      if (model === 'animeganv3') {
        return NextResponse.json({ ok: false, message: 'animeganv3 requires an input image. Use sd-lora for prompt-only mode.' }, { status: 400 })
      }
    } else if (!model) {
      model = 'animeganv3'
    }

    // Smart fallback: if user requests sd-lora but it's not available, fall back to basic mode
    let useFallback = false
    if (model === 'sd-lora' && !imageFile) {
      // Try sd-lora first, but prepare fallback
      useFallback = true
    }

    // Forward to worker for ALL models if configured (bypass local tmp/disk)
    const workerUrl = process.env.INGEST_WORKER_URL || process.env.GHIBLI_WORKER_URL || ''
    console.log('[Ghibli] Worker URL configured:', !!workerUrl, workerUrl ? `${workerUrl.substring(0, 30)}...` : 'none')
    if (workerUrl) {
      // Pre-cleanup: Clear worker disk space before generation
      try {
        const workerBase = workerUrl.replace(/\/$/, '')
        console.log('[Ghibli] Pre-cleaning worker disk space...')
        const cleanupRes = await fetch(workerBase + '/cleanup', { method: 'POST' })
        if (cleanupRes.ok) {
          const cleanupData = await cleanupRes.json()
          console.log('[Ghibli] Worker cleanup result:', cleanupData)
        } else {
          console.warn('[Ghibli] Worker cleanup failed, proceeding anyway')
        }
      } catch (e) {
        console.warn('[Ghibli] Worker cleanup error, proceeding anyway:', e)
      }
      const lora = (fd.get('lora') as string) || ''
      const loraAlpha = (fd.get('lora_alpha') as string) || ''
      const wf = new FormData()
      wf.append('prompt', prompt)
      wf.append('model', model)
      if (lora) wf.append('lora', lora)
      if (loraAlpha) wf.append('lora_alpha', loraAlpha)
      if (imageFile && typeof (imageFile as any).arrayBuffer === 'function') {
        try {
          const ab = await (imageFile as any).arrayBuffer()
          const blob = new Blob([ab], { type: (imageFile as any).type || 'image/png' })
          const name = (imageFile as any).name || 'input.png'
          ;(wf as any).append('image', blob as any, name)
        } catch {
          // fallback to direct append
          wf.append('image', imageFile as any)
        }
      }
      const workerBase = workerUrl.replace(/\/$/, '')
      console.log('[Ghibli] Forwarding to worker:', workerBase + '/generate-image')
      let res: Response
      try {
        res = await fetch(workerBase + '/generate-image', { 
          method: 'POST', 
          body: wf,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })
      } catch (fetchError) {
        console.log('[Ghibli] Worker fetch failed, using local fallback:', fetchError)
        // Continue to local processing if worker is unreachable
        res = null as any
      }
      let data: any = null
      if (res) {
        try { data = await res.json() } catch {}
        console.log('[Ghibli] Worker response:', { status: res.status, ok: res.ok, dataOk: data?.ok, message: data?.message })
      }
      if (!res || !res.ok || !data?.ok) {
        const msg = (data && (data.message || data.error)) || 'worker failed'
        const status = res?.status || 'unknown'
        console.log('[Ghibli] Worker failed, falling back to local processing:', { status, msg })
        
        // Handle specific error cases with appropriate fallbacks
        if (/ENOSPC|No space left on device/i.test(String(msg))) {
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="384" viewBox="0 0 640 384"><rect width="100%" height="100%" fill="#f5f5f5"/><text x="16" y="32" font-family="sans-serif" font-size="16" fill="#222">Image generation fallback (ENOSPC)</text><text x="16" y="64" font-family="sans-serif" font-size="14" fill="#444">Prompt:</text><text x="16" y="90" font-family="sans-serif" font-size="12" fill="#666">${esc(prompt).slice(0,200)}</text></svg>`
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { used: 'worker', prompt, model, fallback: 'svg', reason: 'ENOSPC from worker', error: msg } })
        }
        
        // Handle rate limiting (429) with a specific message
        if (status === 429) {
          console.log('[Ghibli] Worker rate limited, using local fallback')
        }
        
        // For other worker failures, continue to local processing instead of returning 500
        console.log('[Ghibli] Worker unavailable, using local fallback')
      } else {
        // Worker succeeded, return the result
        const outputUrl: string | undefined = data.outputUrl || (typeof data.outputPath === 'string' ? workerBase + data.outputPath : undefined)
        return NextResponse.json({ ok: true, outputUrl, meta: { used: 'worker', ...(data.meta || { prompt, model }) } })
      }
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
    
    // Smart fallback: if sd-lora fails due to missing dependencies, try a graceful alternative
    if (
      !result.ok &&
      useFallback &&
      model === 'sd-lora' &&
      /Stable Diffusion not available|ImportError|ModuleNotFoundError|No module named\s*['\"]?torch|No module named/i.test(String(result.message || ''))
    ) {
      console.log('[Ghibli] SD failed (missing deps), selecting fallback based on presence of input image')
      if (inputImagePath) {
        // If user supplied an image, we can try the lightweight style transfer
        const fallbackArgs = ['--prompt', prompt, '--model', 'animeganv3', '--out', outPath, '--input_image', inputImagePath]
        result = await runPython('scripts/ghibli/image_generate.py', fallbackArgs)
        if (result.ok) {
          result.meta = { ...result.meta, fallback: true, originalModel: 'sd-lora' }
        }
      } else {
        // Prompt-only and SD unavailable: return an SVG placeholder instead of error
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        const cleanPrompt = esc(prompt).slice(0, 240)
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="384" viewBox="0 0 640 384">
  <rect width="100%" height="100%" fill="#f0f9ff"/>
  <text x="320" y="120" font-family="Arial, sans-serif" font-size="24" fill="#0369a1" text-anchor="middle">AI Model Not Available</text>
  <text x="320" y="160" font-family="Arial, sans-serif" font-size="16" fill="#0369a1" text-anchor="middle">Stable Diffusion missing (torch not installed)</text>
  <text x="320" y="205" font-family="Arial, sans-serif" font-size="13" fill="#111" text-anchor="middle">Prompt:</text>
  <foreignObject x="20" y="215" width="600" height="140">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial, sans-serif;font-size:12px;color:#333;word-wrap:break-word;white-space:pre-wrap;">${cleanPrompt}</div>
  </foreignObject>
</svg>`
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'missing_dependencies' } })
      }
    }
    if (!result.ok) {
      const msg = String(result.message || '')
      if (/ENOSPC|No space left on device/i.test(msg)) {
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        const cleanPrompt = esc(prompt).slice(0, 200) // Shorter prompt to avoid SVG issues
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="640" height="384"><rect width="100%" height="100%" fill="#f5f5f5"/><text x="16" y="32" font-family="sans-serif" font-size="16" fill="#222">Image generation fallback (ENOSPC)</text><text x="16" y="64" font-family="sans-serif" font-size="14" fill="#444">Prompt:</text><text x="16" y="90" font-family="sans-serif" font-size="12" fill="#666">${cleanPrompt}</text></svg>`
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
          const dataUrl = `data:image/png;base64,${base64}`
          console.log(`[Ghibli] Generated Base64 data URL, length: ${dataUrl.length}, buffer size: ${buf.length}`)
          try { await unlink(finalPath) } catch {}
          return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { used: 'local', ...(result.meta || { prompt, model, inline: true }) } })
        }
      } catch {}
    }
    const publicPath = `/api/ghibli/file?path=${encodeURIComponent(finalPath)}`
    return NextResponse.json({ ok: true, outputPath: publicPath, meta: { used: 'local', ...(result.meta || { prompt, model }) } })
  } catch (e: any) {
    const msg = String(e?.message || '')
    
    // Handle different types of errors with appropriate fallbacks
    if (/ENOSPC|No space left on device/i.test(msg)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="384" viewBox="0 0 640 384">
        <rect width="100%" height="100%" fill="#fef2f2"/>
        <text x="320" y="120" font-family="Arial, sans-serif" font-size="24" fill="#991b1b" text-anchor="middle">⚠️ Server Out of Space</text>
        <text x="320" y="160" font-family="Arial, sans-serif" font-size="16" fill="#991b1b" text-anchor="middle">ENOSPC Error</text>
        <text x="320" y="200" font-family="Arial, sans-serif" font-size="14" fill="#666" text-anchor="middle">Please try again later or use a GPU worker</text>
        <text x="320" y="240" font-family="Arial, sans-serif" font-size="12" fill="#999" text-anchor="middle">Render.com has limited disk space for AI models</text>
      </svg>`
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      console.log(`[Ghibli] Generated ENOSPC SVG fallback, data URL length: ${dataUrl.length}`)
      return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { fallback: 'svg', reason: 'ENOSPC' } })
    }
    
    if (/Stable Diffusion not available|ImportError|ModuleNotFoundError|No module named\s*['\"]?torch|No module named/i.test(msg)) {
      // Generate a simple PNG fallback using a 1x1 pixel with text overlay
      const canvas = `
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="384" viewBox="0 0 640 384">
          <rect width="100%" height="100%" fill="#f0f9ff"/>
          <text x="320" y="120" font-family="Arial, sans-serif" font-size="24" fill="#0369a1" text-anchor="middle">🤖 AI Model Not Available</text>
          <text x="320" y="160" font-family="Arial, sans-serif" font-size="16" fill="#0369a1" text-anchor="middle">Stable Diffusion not installed</text>
          <text x="320" y="200" font-family="Arial, sans-serif" font-size="14" fill="#666" text-anchor="middle">Using basic image generation instead</text>
          <text x="320" y="240" font-family="Arial, sans-serif" font-size="12" fill="#999" text-anchor="middle">Set up GPU worker for full AI capabilities</text>
        </svg>`
      
      // Use a simpler approach - create a data URL that browsers can definitely handle
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvas)}`
      console.log(`[Ghibli] Generated missing dependencies fallback, data URL length: ${dataUrl.length}`)
      return NextResponse.json({ ok: true, outputUrl: dataUrl, meta: { fallback: 'svg', reason: 'missing_dependencies' } })
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
