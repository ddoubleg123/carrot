import { NextResponse } from 'next/server'
import { receiveMail } from '@/lib/mail/box'

export async function POST(request: Request) {
  const secret = process.env.MAIL_INBOUND_SECRET
  if (!secret || request.headers.get('x-mail-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null) as {
    to?: string
    from?: string
    subject?: string
    text?: string
    messageId?: string
  } | null
  if (!body?.to || !body.from) return NextResponse.json({ error: 'Missing mail.' }, { status: 400 })
  const result = await receiveMail({
    to: body.to,
    from: body.from,
    subject: body.subject || '',
    text: body.text || '',
    messageId: body.messageId || null,
  })
  return NextResponse.json(result)
}
