import { NextResponse } from 'next/server'
import { curatorAllowed } from '@/lib/curator/access'
import { addChannel, listChannels, removeChannel } from '@/lib/curator/channels'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function allowed(): Promise<boolean> {
  return curatorAllowed()
}

export async function GET(_request: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const channels = await listChannels()
  return NextResponse.json({ channels })
}

export async function POST(request: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const url = typeof body?.url === 'string' ? body.url : ''
  try {
    const channel = await addChannel(url)
    const channels = await listChannels()
    return NextResponse.json({ channel, channels })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The channel could not be added.' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const handle = typeof body?.handle === 'string' ? body.handle : ''
  if (!handle) return NextResponse.json({ error: 'Name the channel to remove.' }, { status: 400 })
  await removeChannel(handle)
  return NextResponse.json({ channels: await listChannels() })
}
