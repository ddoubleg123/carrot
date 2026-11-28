import { NextResponse } from 'next/server'
import { applyCheckout, stripe } from '@/lib/funds'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  if (!secret.startsWith('whsec_')) {
    return NextResponse.json({ error: 'Webhook secret is not set.' }, { status: 503 })
  }
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  const payload = await request.text()
  let event
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const result = await applyCheckout(event.data.object)
    if (result.error && result.status !== 409) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
  }
  return NextResponse.json({ received: true })
}
