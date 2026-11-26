import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { ADMIN_EMAILS } from '@/lib/admin'

let tableReady = false

async function readyTable(): Promise<void> {
  if (tableReady) return
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS qa_events (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind TEXT NOT NULL,
    severity INT,
    post_id TEXT,
    source_url TEXT,
    reason TEXT
  )`)
  tableReady = true
}

export async function logQa(event: {
  kind: 'check' | 'fix' | 'hold' | 'correction' | 'report' | 'timeout'
  severity?: number
  postId?: string
  sourceUrl?: string
  reason: string
}): Promise<void> {
  try {
    await readyTable()
    const reason = event.reason.replace(/\s+/g, ' ').trim().slice(0, 500)
    await prisma.$executeRawUnsafe(
      `INSERT INTO qa_events (id, kind, severity, post_id, source_url, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      randomUUID(),
      event.kind,
      event.severity ?? null,
      event.postId || null,
      event.sourceUrl || null,
      reason
    )
  } catch (error) {
    console.error('[qa] log', error instanceof Error ? error.message : error)
  }
}

/** The duty reviewer is the admin rota. A failed send still leaves the item held. */
export async function notifyDutyReviewer(reason: string, url: string): Promise<void> {
  console.error('[qa] held', reason)
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!key || !from) return
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)
    await resend.emails.send({
      from,
      to: [...ADMIN_EMAILS],
      subject: 'Carrot QA hold',
      text: `${reason}\n${url}\nThe item was not posted. It stays held until you decide. If you do not respond in 2 hours, it stays held.`
    })
  } catch (error) {
    console.error('[qa] notify', error instanceof Error ? error.message : error)
  }
}

export interface QaRow {
  id: string
  createdAt: Date
  kind: string
  severity: number | null
  postId: string | null
  sourceUrl: string | null
  reason: string | null
}

export async function recentQa(days: number): Promise<QaRow[]> {
  await readyTable()
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string
    created_at: Date
    kind: string
    severity: number | null
    post_id: string | null
    source_url: string | null
    reason: string | null
  }>>(
    `SELECT id, created_at, kind, severity, post_id, source_url, reason
     FROM qa_events
     WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
     ORDER BY created_at DESC
     LIMIT 200`,
    days
  )
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    severity: row.severity,
    postId: row.post_id,
    sourceUrl: row.source_url,
    reason: row.reason
  }))
}
