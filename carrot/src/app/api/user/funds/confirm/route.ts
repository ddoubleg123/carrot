import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { applyCheckout, paymentsOn, stripe } from '@/lib/funds'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!paymentsOn()) {
    return NextResponse.json({ error: 'Stripe is not connected yet.' }, { status: 503 })
  }
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 })
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const checkout = await stripe().checkout.sessions.retrieve(sessionId)
  const result = await applyCheckout(checkout, user.id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ cents: result.cents })
}
