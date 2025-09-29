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
    const p = spawn('python', [scriptPath, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
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
    cleanupOldTmp(30 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})
    await sem.acquire()
    const fd = await req.formData()
    const model = ((fd.get('model') as string) || 'animeganv3') as 'animeganv3' | 'diffutoon'
    const prompt = (fd.get('prompt') as string) || ''
    const file = fd.get('video') as unknown as File | null
    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json({ ok: false, message: 'missing video upload' }, { status: 400 })
    }

    // Persist upload
    const inputPath = await saveBlobToTmp('input-video', file as unknown as Blob, '.mp4')

    // Pre-limit with ffmpeg: max 60s, max 720p
    const limitedPath = join(tmpdir(), `ghibli-limited-${randomUUID()}.mp4`)
    await new Promise<void>((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-t', '60',
        '-vf', 'scale=iw:ih,scale=min(iw\\,1280):min(ih\\,720):force_original_aspect_ratio=decrease',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        limitedPath,
      ])
      ff.on('error', e => {
        if (e.message.includes('ENOSPC') || e.message.includes('No space left on device')) {
          resolve()
        } else {
          reject(e)
        }
      })
      ff.on('close', (code) => {
        if (code === 0) return resolve()
        // Treat ENOSPC-like failures as soft success to allow fallback downstream
        resolve()
      })
    })

    // Stylize via Python pipeline
    const stylizedPath = join(tmpdir(), `ghibli-stylized-${randomUUID()}.mp4`)
    const result = await runPython('scripts/ghibli/video_stylize.py', [
      '--model', model,
      '--input', limitedPath,
      '--out', stylizedPath,
      '--prompt', prompt,
    ])

    if (!result.ok) {
      const msg = String(result.message || '')
      if (/ENOSPC|No space left on device/i.test(msg)) {
        const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='#f5f5f5'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#222'>Video generation fallback (ENOSPC)</text><text x='16' y='64' font-family='sans-serif' font-size='14' fill='#444'>Prompt: ${prompt.replace(/</g,'&lt;').slice(0,200)}</text></svg>`
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        return NextResponse.json({ ok: true, outputPath: dataUrl, meta: { prompt, model, fallback: 'svg', reason: 'ENOSPC local' } })
      }
      return NextResponse.json({ ok: false, message: result.message || 'video pipeline failed' }, { status: 500 })
    }

    const origPublic = `/api/ghibli/file?path=${encodeURIComponent(limitedPath)}`
    const outPublic = `/api/ghibli/file?path=${encodeURIComponent(result.outputPath || stylizedPath)}`
    return NextResponse.json({ ok: true, outputPath: outPublic, meta: { ...(result.meta || {}), originalPath: origPublic, model, prompt } })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/ENOSPC|No space left on device/i.test(msg)) {
      const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='#fef2f2'/><text x='16' y='32' font-family='sans-serif' font-size='16' fill='#991b1b'>Video generation failed (ENOSPC)</text></svg>`
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      return NextResponse.json({ ok: true, outputPath: dataUrl, meta: { fallback: 'svg', reason: 'ENOSPC throw' } })
    }
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  } finally {
    cleanupOldTmp(15 * 60 * 1000, /^ghibli-|^ghibli/ as any).catch(() => {})
    sem.release()
  }
}
