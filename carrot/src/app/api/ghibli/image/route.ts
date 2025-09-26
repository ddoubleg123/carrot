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
    const fd = await req.formData()
    const prompt = (fd.get('prompt') as string) || ''
    const model = ((fd.get('model') as string) || 'animeganv3') as 'animeganv3' | 'sd-lora'
    const imageFile = fd.get('image') as unknown as File | null
    let inputImagePath = ''

    // If configured, forward sd-lora jobs to a remote GPU worker (FastAPI)
    const workerUrl = process.env.GHIBLI_WORKER_URL || ''
    if (workerUrl && model === 'sd-lora') {
      const payload: any = { prompt }
      // If an image is uploaded, attach as multipart; otherwise send JSON only
      if (imageFile && typeof imageFile.arrayBuffer === 'function') {
        const wf = new FormData()
        wf.append('prompt', prompt)
        wf.append('model', 'sd-lora')
        wf.append('image', imageFile as any)
        const res = await fetch(workerUrl.replace(/\/$/, '') + '/generate-image', { method: 'POST', body: wf })
        const data = await res.json()
        if (!data.ok) {
          return NextResponse.json({ ok: false, message: data.message || 'worker failed' }, { status: 500 })
        }
        // Worker returns a direct URL; pass through
        return NextResponse.json({ ok: true, outputPath: data.outputUrl || data.outputPath, meta: data.meta || { prompt, model } })
      } else {
        const res = await fetch(workerUrl.replace(/\/$/, '') + '/generate-image', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'sd-lora' })
        })
        const data = await res.json()
        if (!data.ok) {
          return NextResponse.json({ ok: false, message: data.message || 'worker failed' }, { status: 500 })
        }
        return NextResponse.json({ ok: true, outputPath: data.outputUrl || data.outputPath, meta: data.meta || { prompt, model } })
      }
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
      return NextResponse.json({ ok: false, message: result.message || 'image pipeline failed' }, { status: 500 })
    }

    const publicPath = `/api/ghibli/file?path=${encodeURIComponent(result.outputPath || outPath)}`
    return NextResponse.json({ ok: true, outputPath: publicPath, meta: result.meta || { prompt, model } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  }
}
