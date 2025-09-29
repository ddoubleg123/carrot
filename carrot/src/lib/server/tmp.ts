import { promises as fsp } from 'fs'
import { tmpdir } from 'os'
import { join, basename } from 'path'

// Utilities for managing temporary files on constrained hosts (e.g., Render free tier)
// - Clean up old files
// - Guarded path resolution inside OS temp dir
// - Simple semaphore to limit concurrency when needed

export const TMP_ROOT = tmpdir()

export function tmpPath(name: string) {
  return join(TMP_ROOT, name)
}

export async function safeUnlink(p: string) {
  try { await fsp.unlink(p) } catch {}
}

export async function listTmp(pattern?: RegExp) {
  try {
    const entries = await fsp.readdir(TMP_ROOT)
    return entries
      .filter((n) => !pattern || pattern.test(n))
      .map((n) => ({ name: n, path: join(TMP_ROOT, n) }))
  } catch {
    return []
  }
}

export async function cleanupOldTmp(maxAgeMs = 30 * 60 * 1000, namePattern?: RegExp) {
  const now = Date.now()
  const items = await listTmp(namePattern)
  for (const it of items) {
    try {
      const st = await fsp.stat(it.path)
      const age = now - st.mtimeMs
      if (age > maxAgeMs) {
        await safeUnlink(it.path)
      }
    } catch {}
  }
}

// Recursively delete tmp entries that start with a prefix (e.g., 'ghibli-')
export async function cleanupTmpPrefixRecursive(prefix: string, maxAgeMs = 10 * 60 * 1000) {
  const dir = TMP_ROOT
  const now = Date.now()
  let names: string[] = []
  try { names = await fsp.readdir(dir) } catch { return }
  for (const name of names) {
    if (!name.startsWith(prefix)) continue
    const p = join(dir, name)
    try {
      const st = await fsp.stat(p)
      const age = now - st.mtimeMs
      if (age < maxAgeMs) continue
      if (st.isDirectory()) {
        await rmRecursive(p)
      } else {
        await safeUnlink(p)
      }
    } catch {}
  }
}

async function rmRecursive(p: string) {
  try {
    const st = await fsp.stat(p)
    if (st.isDirectory()) {
      const entries = await fsp.readdir(p)
      for (const e of entries) {
        await rmRecursive(join(p, e))
      }
      try { await fsp.rmdir(p) } catch { /* node <14: fallback */ try { await fsp.rm(p, { recursive: true, force: true } as any) } catch {} }
    } else {
      await safeUnlink(p)
    }
  } catch {}
}

// Basic path guard: only allow serving files from OS temp directory
export function isPathInTmp(p: string) {
  const b = basename(p)
  // Prevent path traversal and restrict to tmp dir files only
  return !b.includes('..') && p.startsWith(TMP_ROOT)
}

// Simple semaphore to limit concurrent heavy jobs
export class Semaphore {
  private queue: Array<() => void> = []
  private permits: number
  constructor(permits: number) { this.permits = Math.max(1, permits) }
  async acquire() {
    if (this.permits > 0) { this.permits--; return }
    await new Promise<void>(res => this.queue.push(res))
  }
  release() {
    const next = this.queue.shift()
    if (next) next(); else this.permits++
  }
}
