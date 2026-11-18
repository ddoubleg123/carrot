import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { PublicUrlError } from '@/lib/learn/publicUrl'
import { showFollowers } from '@/lib/activityFeed'
import { addTopicAddendum, addTopicClip, addTopicImageFromUrl, addTopicImageSource, addTopicReply, addTopicSource, addTopicText, addTopicUploadedPdf, addTopicUploadedVideo, addTopicVideo, askTopic, decideTopicSource, saveTopicNote, searchTopic, setTopicUnrelated, voteTopicSource } from '@/lib/learn/topic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function access(handle: string, userId: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, createdBy: true }
  })
  if (!patch) return { error: NextResponse.json({ error: 'Group not found' }, { status: 404 }) }
  if (patch.createdBy === userId) return { patch }
  const member = await prisma.patchMember.findUnique({
    where: { patch_user_member_unique: { patchId: patch.id, userId } },
    select: { id: true }
  })
  if (!member) return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) }
  return { patch }
}

async function displayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true }
  })
  return user?.name || user?.username || 'Member'
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string; id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { handle, id } = await params
  const allowed = await access(handle, session.user.id)
  if (allowed.error) return allowed.error
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    const picked = form?.get('file') ?? form?.get('image')
    const file = picked instanceof File ? picked : null
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture or video.' }, { status: 400 })
    const caption = typeof form?.get('caption') === 'string' ? String(form.get('caption')) : ''
    const lookFor = typeof form?.get('lookFor') === 'string' ? String(form.get('lookFor')).trim().slice(0, 200) : ''
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      const member = await displayName(session.user.id)
      const pdf = file.type === 'application/pdf' || file.type === 'application/x-pdf' || file.name.toLowerCase().endsWith('.pdf')
      const topic = pdf
        ? await addTopicUploadedPdf(allowed.patch.id, id, session.user.id, member, bytes, file.name, lookFor)
        : file.type.startsWith('video/')
          ? await addTopicUploadedVideo(allowed.patch.id, id, session.user.id, member, bytes, file.type, file.name)
          : await addTopicImageSource(allowed.patch.id, id, session.user.id, member, bytes, file.type, caption)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      await showFollowers(session.user.id, `Added a file on ${allowed.patch.title}: ${topic.question} /patch/${handle}?topic=${topic.slug}`)
      return NextResponse.json({ topic })
    } catch (error) {
      const message = error instanceof PublicUrlError ? error.message : 'Could not save that file.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }
  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''
  const name = await displayName(session.user.id)
  try {
    if (action === 'note') {
      const topic = await saveTopicNote(allowed.patch.id, id, session.user.id, typeof body?.text === 'string' ? body.text : '')
      if (!topic) return NextResponse.json({ error: 'Only the person who asked can edit that note.' }, { status: 403 })
      return NextResponse.json({ topic })
    }
    if (action === 'reply') {
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (text.length < 1) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 })
      const topic = await addTopicReply(allowed.patch.id, id, session.user.id, name, text)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      await showFollowers(session.user.id, `Replied on ${allowed.patch.title}: ${text.slice(0, 180)} /patch/${handle}?topic=${topic.slug}`)
      return NextResponse.json({ topic })
    }
    if (action === 'image') {
      const url = typeof body?.url === 'string' ? body.url.trim() : ''
      if (!url) return NextResponse.json({ error: 'Paste an image link first.' }, { status: 400 })
      const caption = typeof body?.caption === 'string' ? body.caption : ''
      const topic = await addTopicImageFromUrl(allowed.patch.id, id, session.user.id, name, url, caption)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      return NextResponse.json({ topic })
    }
    if (action === 'ask') {
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (text.length < 3) return NextResponse.json({ error: 'Ask about something specific.' }, { status: 400 })
      const topic = await askTopic(allowed.patch.id, id, allowed.patch.title, session.user.id, name, text)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      await showFollowers(session.user.id, `Asked on ${allowed.patch.title}: ${text.slice(0, 180)} /patch/${handle}?topic=${topic.slug}`)
      return NextResponse.json({ topic })
    }
    if (action === 'clip') {
      const quote = typeof body?.quote === 'string' ? body.quote : ''
      const topic = await addTopicClip(allowed.patch.id, id, session.user.id, name, {
        quote,
        url: typeof body?.url === 'string' ? body.url : '',
        title: typeof body?.title === 'string' ? body.title : ''
      })
      if (!topic) return NextResponse.json({ error: 'Select a longer passage first.' }, { status: 400 })
      await showFollowers(session.user.id, `Added a passage on ${allowed.patch.title}: ${topic.question} /patch/${handle}?topic=${topic.slug}`)
      return NextResponse.json({ topic })
    }
    if (action === 'text') {
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (text.length < 1) return NextResponse.json({ error: 'Write something first.' }, { status: 400 })
      const topic = await addTopicText(allowed.patch.id, id, session.user.id, name, text)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      await showFollowers(session.user.id, `Wrote on ${allowed.patch.title}: ${text.slice(0, 180)} /patch/${handle}?topic=${topic.slug}`)
      return NextResponse.json({ topic })
    }
    if (action === 'search') {
      const topic = await searchTopic(allowed.patch.id, id, allowed.patch.title, session.user.id)
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      return NextResponse.json({ topic })
    }
    if (action === 'vote') {
      const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
      const direction = body?.direction === 'down' ? 'down' : body?.direction === 'up' ? 'up' : ''
      if (!sourceId || !direction) return NextResponse.json({ error: 'Choose a source first.' }, { status: 400 })
      const topic = await voteTopicSource(allowed.patch.id, id, session.user.id, sourceId, direction)
      if (!topic) return NextResponse.json({ error: 'That source is no longer on this question.' }, { status: 404 })
      return NextResponse.json({ topic })
    }
    if (action === 'archive' || action === 'restore') {
      const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
      if (!sourceId) return NextResponse.json({ error: 'Choose a source first.' }, { status: 400 })
      const topic = await setTopicUnrelated(allowed.patch.id, id, session.user.id, sourceId, action === 'archive')
      if (!topic) return NextResponse.json({ error: 'Only the person who asked can move that.' }, { status: 403 })
      return NextResponse.json({ topic })
    }
    if (action === 'approve' || action === 'deny') {
      const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
      if (!sourceId) return NextResponse.json({ error: 'Choose a result first.' }, { status: 400 })
      const topic = await decideTopicSource(allowed.patch.id, id, session.user.id, sourceId, action === 'approve')
      if (!topic) return NextResponse.json({ error: 'That result is no longer waiting.' }, { status: 404 })
      return NextResponse.json({ topic })
    }
    if (action === 'video') {
      if (body?.rights !== true && body?.rights !== 'true') return NextResponse.json({ error: 'Confirm you have the rights to add this video.' }, { status: 400 })
      const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.trim() : ''
      if (!pageUrl) return NextResponse.json({ error: 'Paste a video link first.' }, { status: 400 })
      const topic = await addTopicVideo(allowed.patch.id, id, session.user.id, name, {
        pageUrl,
        videoUrl: typeof body?.videoUrl === 'string' ? body.videoUrl.trim() : undefined,
        cfUid: typeof body?.cfUid === 'string' ? body.cfUid.trim() : undefined,
        title: typeof body?.title === 'string' ? body.title : undefined,
        thumbnail: typeof body?.thumbnail === 'string' ? body.thumbnail : undefined,
        captionUrl: typeof body?.captionUrl === 'string' ? body.captionUrl : undefined,
        transcript: typeof body?.transcript === 'string' ? body.transcript : undefined
      })
      if (!topic) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      return NextResponse.json({ topic })
    }
    if (action === 'addendum') {
      const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (!sourceId || text.length < 1) return NextResponse.json({ error: 'Write the note first.' }, { status: 400 })
      const topic = await addTopicAddendum(allowed.patch.id, id, session.user.id, name, sourceId, text)
      if (!topic) return NextResponse.json({ error: 'Only the person who added this, or the person who asked, can add a note.' }, { status: 403 })
      return NextResponse.json({ topic })
    }
    if (action === 'source') {
      const url = typeof body?.url === 'string' ? body.url.trim() : ''
      const lookFor = typeof body?.lookFor === 'string' ? body.lookFor.trim().slice(0, 200) : ''
      if (!url) return NextResponse.json({ error: 'Add a link first.' }, { status: 400 })
      const topic = await addTopicSource(allowed.patch.id, id, session.user.id, name, url, lookFor)
      if (!topic) {
        console.error('[topic] source had no passage')
        return NextResponse.json({ error: 'That page did not include a readable passage.' }, { status: 400 })
      }
      return NextResponse.json({ topic })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[topic] update failed', error instanceof Error ? error.message : error)
    const message = error instanceof PublicUrlError ? error.message : 'Could not update the question.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
