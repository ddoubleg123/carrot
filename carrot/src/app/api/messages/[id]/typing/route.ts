import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { currentUser, noteTyping } from '@/lib/mail/box'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  const { id } = await context.params
  await noteTyping(user.id, id)
  return NextResponse.json({ ok: true })
}
