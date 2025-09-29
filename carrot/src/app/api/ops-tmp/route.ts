import { NextResponse } from 'next/server'
import { readdir, stat, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const dir = tmpdir()
    const names = await readdir(dir)
    const items: any[] = []
    for (const name of names) {
      const p = join(dir, name)
      try {
        const st = await stat(p)
        items.push({ name, size: st.size ?? 0, mtime: st.mtime.toISOString() })
      } catch {}
    }
    items.sort((a,b)=> b.size - a.size)
    return NextResponse.json({ ok: true, dir, items })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const olderThan = parseInt(url.searchParams.get('olderThanMs') || '1800000', 10)
    const dir = tmpdir()
    const names = await readdir(dir)
    const now = Date.now()
    let deleted = 0
    for (const name of names) {
      const p = join(dir, name)
      try {
        const st = await stat(p)
        const age = now - st.mtimeMs
        if (age > olderThan) { await unlink(p); deleted++ }
      } catch {}
    }
    return NextResponse.json({ ok: true, deleted })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
