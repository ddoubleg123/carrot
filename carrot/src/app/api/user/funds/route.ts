import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { centsOf, paymentsOn, requestOrigin, stripe } from '@/lib/funds'

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email }, select: { metadata: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ cents: centsOf(user.metadata), payments: paymentsOn() })
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!paymentsOn()) {
    return NextResponse.json({ error: 'Stripe is not connected yet.' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}))
  const dollars = Number(body?.dollars)
  const cents = Math.round(dollars * 100)
  if (!Number.isFinite(dollars) || cents < 100 || cents > 50000) {
    return NextResponse.json({ error: 'Enter an amount from $1 to $500.' }, { status: 400 })
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const origin = requestOrigin(request)
  const checkout = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email || undefined,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents,
        product_data: { name: 'Carrot balance' },
      },
    }],
    metadata: { userId: user.id, cents: String(cents) },
    success_url: `${origin}/dashboard/funds?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/funds`,
  })
  if (!checkout.url) {
    return NextResponse.json({ error: 'Stripe did not open a checkout page.' }, { status: 502 })
  }
  return NextResponse.json({ url: checkout.url })
}
