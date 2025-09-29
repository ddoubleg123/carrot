import { NextResponse } from 'next/server'
import { stat, readdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getStoreDir() {
  const dir = process.env.CARROT_DATA_DIR || join(tmpdir(), 'carrot-training')
  return dir
}

async function dirSize(path: string): Promise<number> {
  try {
    const st = await stat(path)
    if (!st.isDirectory()) return st.size
  } catch {
    return 0
  }
  let total = 0
  try {
    const entries = await readdir(path, { withFileTypes: true })
    for (const d of entries) {
      const p = join(path, d.name)
      try {
        if (d.isDirectory()) total += await dirSize(p)
        else total += (await stat(p)).size
      } catch {}
    }
  } catch {}
  return total
}

export async function GET() {
  try {
    const dir = getStoreDir()
    const size = await dirSize(dir)
    return NextResponse.json({ ok: true, dir, size })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

// Danger: deletes entire training store directory contents
export async function DELETE() {
  try {
    const dir = getStoreDir()
    // Remove directory contents recursively (leave the dir in place)
    try { await rm(dir, { recursive: true, force: true }) } catch {}
    return NextResponse.json({ ok: true, dir, deleted: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
