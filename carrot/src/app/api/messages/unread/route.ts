import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { currentUser, unreadCounts } from '@/lib/mail/box'

export async function GET() {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ messages: 0, mail: 0 })
  return NextResponse.json(await unreadCounts(user.id))
}
