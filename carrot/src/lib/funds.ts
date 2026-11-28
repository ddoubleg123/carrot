import Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function centsOf(metadata: unknown): number {
  const cents = Number(asRecord(metadata).fundsCents)
  return Number.isFinite(cents) && cents > 0 ? Math.floor(cents) : 0
}

export function paymentsOn(): boolean {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_')
}

let stripeClient: Stripe | null = null

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY || ''
  if (!key.startsWith('sk_')) throw new Error('Stripe is not connected')
  if (!stripeClient) stripeClient = new Stripe(key)
  return stripeClient
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  if (host) return `${proto}://${host}`
  return 'http://localhost:3005'
}

export async function creditPaidSession(userId: string, sessionId: string, addCents: number): Promise<number> {
  if (!sessionId.startsWith('cs_') || !Number.isInteger(addCents) || addCents < 100 || addCents > 50000) {
    throw new Error('Payment could not be recorded')
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
    if (!user) throw new Error('User not found')
    const meta = asRecord(user.metadata)
    const sessions = Array.isArray(meta.fundSessions)
      ? meta.fundSessions.filter((id): id is string => typeof id === 'string')
      : []
    if (sessions.includes(sessionId)) return centsOf(meta)
    const nextCents = centsOf(meta) + addCents
    const next = {
      ...meta,
      fundsCents: nextCents,
      fundSessions: [...sessions, sessionId].slice(-40),
    }
    const where = user.metadata == null
      ? { id: userId, metadata: { equals: Prisma.DbNull } }
      : { id: userId, metadata: { equals: user.metadata as Prisma.InputJsonValue } }
    const updated = await prisma.user.updateMany({
      where,
      data: { metadata: next as Prisma.InputJsonValue },
    })
    if (updated.count === 1) return nextCents
  }
  throw new Error('Payment could not be recorded')
}

export async function applyCheckout(session: Stripe.Checkout.Session, expectUserId?: string) {
  const userId = session.metadata?.userId || ''
  if (!userId) return { error: 'This payment is missing an account.', status: 400 }
  if (expectUserId && expectUserId !== userId) return { error: 'This payment belongs to another account.', status: 403 }
  if (session.mode !== 'payment' || session.payment_status !== 'paid') {
    return { error: 'Payment did not finish.', status: 409 }
  }
  const cents = session.amount_total
  if (cents == null || cents < 100 || cents > 50000) {
    return { error: 'Payment amount is outside $1 to $500.', status: 400 }
  }
  const balance = await creditPaidSession(userId, session.id, cents)
  return { cents: balance, status: 200 }
}
