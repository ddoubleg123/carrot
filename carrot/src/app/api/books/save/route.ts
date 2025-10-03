import { NextResponse } from 'next/server'
import { app as firebaseAdminApp } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper: post buffer to external ClamAV microservice compatible API
async function scanWithExternalService(fileName: string, buf: Buffer): Promise<{ ok: boolean; raw: any }> {
  const scannerUrl = process.env.FILE_SCANNER_URL // e.g. http://scanner:5000/scan
  if (!scannerUrl) return { ok: true, raw: { skipped: true, reason: 'no FILE_SCANNER_URL set' } }
  const form = new FormData()
  form.append('file', new Blob([buf as unknown as ArrayBuffer]), fileName)
  const res = await fetch(scannerUrl.replace(/\/$/,'') + '/scan', { method: 'POST', body: form as any })
  const json = await res.json().catch(()=>({}))
  const text: string = json?.scan_result || JSON.stringify(json)
  // Consider clean if clamscan reports OK
  const ok = /OK\s*$/m.test(text) && !/FOUND/m.test(text)
  return { ok, raw: text }
}

// Upload to Firebase Storage using admin SDK
async function uploadToFirebase(path: string, buf: Buffer, contentType: string): Promise<{ publicUrl: string; signedUrl?: string }> {
  // @ts-ignore
  const admin = require('firebase-admin')
  const bucket = admin.storage().bucket()
  const file = bucket.file(path)
  await file.save(buf, { contentType, resumable: false, public: false, metadata: { contentType } })
  // Generate a signed URL valid for 7 days
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const publicUrl = `gs://${bucket.name}/${path}`
  return { publicUrl, signedUrl }
}

// POST /api/books/save
// Body: { url?: string, title?: string, tags?: string[], allowDomains?: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>null)
    if (!body?.url) return NextResponse.json({ ok: false, error: 'url required' }, { status: 400 })
    const url: string = String(body.url)
    const title: string | undefined = body.title

    // Basic allowlist checks (defense-in-depth if scanner absent)
    const allow: string[] = Array.isArray(body.allowDomains) ? body.allowDomains : ['arxiv.org','gutenberg.org','archive.org','nih.gov','ncbi.nlm.nih.gov','openlibrary.org','books.google.com']
    try {
      const u = new URL(url)
      if (!allow.includes(u.hostname) && !process.env.FILE_SCANNER_URL) {
        return NextResponse.json({ ok: false, error: 'domain not allowed without scanner' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid url' }, { status: 400 })
    }

    // Download
    const head = await fetch(url, { method: 'HEAD' }).catch(()=>null as any)
    const size = Number(head?.headers?.get('content-length') || '0')
    if (size && size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'file too large (25MB limit)' }, { status: 400 })
    }
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ ok: false, error: `download failed: ${res.status}` }, { status: res.status })
    const contentType = res.headers.get('content-type') || 'application/pdf'
    const ab = await res.arrayBuffer()
    const buf = Buffer.from(ab)
    // PDF signature check
    const sig = buf.subarray(0, 5).toString('utf8')
    if (sig !== '%PDF-') return NextResponse.json({ ok: false, error: 'not a PDF file' }, { status: 400 })

    // Virus scan (if configured)
    const scan = await scanWithExternalService(url.split('/').pop() || 'file.pdf', buf)
    if (!scan.ok) {
      return NextResponse.json({ ok: false, error: 'virus scan failed / infected', scan: scan.raw }, { status: 400 })
    }

    // Store
    const namePart = (title || 'book').toLowerCase().replace(/[^a-z0-9\-]+/g,'-').slice(0,40)
    const ts = Date.now()
    const path = `books/${ts}-${namePart || 'pdf'}.pdf`
    const { signedUrl } = await uploadToFirebase(path, buf, contentType)

    // Viewer URL using pdf.js (Mozilla hosted) or internal if present
    const viewer = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(signedUrl!)}`

    return NextResponse.json({ ok: true, id: `${ts}`, fileUrl: signedUrl, viewerUrl: viewer })
  } catch (e:any) {
    console.error('[books/save] error', e)
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
