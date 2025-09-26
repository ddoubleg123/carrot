import { NextResponse } from 'next/server'
import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
        '-vf', 'scale=iw:ih,scale=min(iw\,1280):min(ih\,720):force_original_aspect_ratio=decrease',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        limitedPath,
      ])
      ff.on('error', reject)
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg preprocess failed')))
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
      return NextResponse.json({ ok: false, message: result.message || 'video pipeline failed' }, { status: 500 })
    }

    const origPublic = `/api/ghibli/file?path=${encodeURIComponent(limitedPath)}`
    const outPublic = `/api/ghibli/file?path=${encodeURIComponent(result.outputPath || stylizedPath)}`
    return NextResponse.json({ ok: true, outputPath: outPublic, meta: { ...(result.meta || {}), originalPath: origPublic, model, prompt } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  }
}
