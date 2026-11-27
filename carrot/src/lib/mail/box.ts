import { prisma } from '@/lib/prisma'
import { mailAddress, sendCarroMail } from '@/lib/mail/send'
import { botReply, ensureBot } from '@/lib/mail/botReply'

const DOMAIN = 'carro7.com'
const RESERVED = new Set(['postmaster', 'abuse', 'support', 'admin', 'noreply', 'mailer-daemon'])
const TYPING_MS = 4000

export type MailView = {
  id: string
  kind: 'dm' | 'email'
  name: string
  handle: string
  subject: string | null
  unread: number
  preview: string
  at: number | null
  mine: boolean
  bot: boolean
}

export type MailLine = {
  id: string
  from: 'me' | 'them'
  text: string
  image: string | null
  at: number
  state: string
  reason: string | null
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function addressOf(raw: string): string | null {
  const match = raw.match(/<([^>]+)>/) || raw.match(/([^\s<>]+@[^\s<>]+)/)
  const email = (match?.[1] || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function localPart(email: string): string {
  return email.split('@')[0].split('+')[0].toLowerCase()
}

async function viewer(email: string | null | undefined) {
  if (!email) return null
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, username: true },
  })
}

export async function currentUser(email: string | null | undefined) {
  return viewer(email)
}

function display(user: { name: string | null; username: string | null }) {
  return user.name || user.username || 'Carrot'
}

export async function listThreads(user: { id: string; username: string | null }): Promise<{ address: string | null; threads: MailView[] }> {
  const userId = user.id
  const memberships = await prisma.mailMember.findMany({
    where: { userId },
    include: {
      thread: {
        include: {
          members: { include: { user: { select: { id: true, name: true, username: true, email: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })
  const threads = memberships
    .map((membership) => {
      const thread = membership.thread
      const other = thread.members.find((member) => member.userId !== userId)?.user
      const last = thread.messages[0]
      const email = thread.kind === 'email'
      return {
        id: thread.id,
        kind: email ? 'email' as const : 'dm' as const,
        name: email ? (thread.outside || 'Email') : display(other || { name: null, username: null }),
        handle: email ? (thread.outside || '') : (other?.username || ''),
        subject: thread.subject,
        unread: membership.unread,
        preview: last?.body || '',
        at: last ? last.createdAt.getTime() : null,
        mine: last?.senderId === userId,
        bot: !email && Boolean(other?.email?.endsWith('@bots.carrot.invalid')),
        updated: thread.updatedAt.getTime(),
      }
    })
    .sort((a, b) => (b.at || b.updated) - (a.at || a.updated))
    .map(({ updated: _updated, ...thread }) => thread)
  return { address: user.username ? mailAddress(user.username) : null, threads }
}

export async function readThread(userId: string, threadId: string): Promise<{ thread: MailView; lines: MailLine[]; typing: string | null } | null> {
  const membership = await prisma.mailMember.findUnique({
    where: { threadId_userId: { threadId, userId } },
    include: {
      thread: {
        include: {
          members: { include: { user: { select: { id: true, name: true, username: true, email: true } } } },
          messages: { orderBy: { createdAt: 'asc' }, take: 200 },
        },
      },
    },
  })
  if (!membership) return null
  if (membership.unread > 0) {
    await prisma.mailMember.update({ where: { id: membership.id }, data: { unread: 0 } })
  }
  const thread = membership.thread
  const other = thread.members.find((member) => member.userId !== userId)?.user
  const email = thread.kind === 'email'
  const since = new Date(Date.now() - TYPING_MS)
  const typing = await prisma.mailTyping.findFirst({
    where: { threadId, userId: { not: userId }, at: { gt: since } },
    include: { user: { select: { name: true, username: true } } },
  })
  const last = thread.messages[thread.messages.length - 1]
  return {
    thread: {
      id: thread.id,
      kind: email ? 'email' : 'dm',
      name: email ? (thread.outside || 'Email') : display(other || { name: null, username: null }),
      handle: email ? (thread.outside || '') : (other?.username || ''),
      subject: thread.subject,
      unread: 0,
      preview: last?.body || '',
      at: last ? last.createdAt.getTime() : null,
      mine: last?.senderId === userId,
      bot: !email && Boolean(other?.email?.endsWith('@bots.carrot.invalid')),
    },
    lines: thread.messages.map((message) => ({
      id: message.id,
      from: message.senderId === userId ? 'me' as const : 'them' as const,
      text: message.body,
      image: message.image,
      at: message.createdAt.getTime(),
      state: message.state,
      reason: message.failReason,
    })),
    typing: typing ? display(typing.user) : null,
  }
}

export async function noteTyping(userId: string, threadId: string) {
  const membership = await prisma.mailMember.findUnique({ where: { threadId_userId: { threadId, userId } } })
  if (!membership) return
  await prisma.mailTyping.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, userId },
    update: { at: new Date() },
  })
}

async function dmThread(userId: string, otherId: string) {
  const mine = await prisma.mailMember.findMany({
    where: { userId, thread: { kind: 'dm' } },
    select: { threadId: true },
  })
  for (const row of mine) {
    const members = await prisma.mailMember.findMany({ where: { threadId: row.threadId }, select: { userId: true } })
    if (members.length === 2 && members.some((member) => member.userId === otherId)) return row.threadId
  }
  const created = await prisma.mailThread.create({
    data: {
      kind: 'dm',
      members: { create: [{ userId }, { userId: otherId }] },
    },
  })
  return created.id
}

export async function beginDm(userId: string, username: string) {
  const handle = username.trim().toLowerCase().replace(/^@/, '')
  if (!handle || RESERVED.has(handle)) return { error: 'That person is not on Carrot.' }
  const found = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: 'insensitive' } },
    select: { id: true },
  })
  const other = found || await ensureBot(handle)
  if (!other || other.id === userId) return { error: 'That person is not on Carrot.' }
  const id = await dmThread(userId, other.id)
  return { id }
}

async function emailThread(userId: string, outside: string, subject: string) {
  const existing = await prisma.mailMember.findFirst({
    where: { userId, thread: { kind: 'email', outside } },
    select: { threadId: true },
  })
  if (existing) return existing.threadId
  const created = await prisma.mailThread.create({
    data: {
      kind: 'email',
      outside,
      subject: clean(subject, 180) || '(no subject)',
      members: { create: [{ userId }] },
    },
  })
  return created.id
}

export async function beginEmail(userId: string, to: string, subject: string) {
  const outside = addressOf(to)
  if (!outside) return { error: 'Enter an email address.' }
  if (outside.endsWith(`@${DOMAIN}`)) {
    return beginDm(userId, localPart(outside))
  }
  const id = await emailThread(userId, outside, subject)
  return { id }
}

function photoData(value: string | null | undefined) {
  if (!value) return null
  if (!/^data:image\/(jpeg|png|gif|webp);base64,/.test(value)) return null
  if (value.length > 550_000) return null
  return value
}

async function answerBot(userId: string, threadId: string, humanText: string) {
  const others = await prisma.mailMember.findMany({
    where: { threadId, userId: { not: userId } },
    include: { user: { select: { id: true, username: true, name: true, email: true } } },
  })
  const bot = others.find((member) => member.user.email?.endsWith('@bots.carrot.invalid'))
  if (!bot?.user.username) return
  const text = await botReply(bot.user.username, bot.user.name || bot.user.username, humanText)
  if (!text) return
  await prisma.mailMessage.create({
    data: { threadId, senderId: bot.user.id, direction: 'out', body: text, state: 'sent' },
  })
  await prisma.mailThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } })
  await prisma.mailMember.updateMany({ where: { threadId, userId }, data: { unread: { increment: 1 } } })
}

export async function speak(userId: string, threadId: string, text: string, image?: string | null) {
  const body = text.replace(/\r/g, '').trim().slice(0, 8000)
  const photo = photoData(image)
  if (!body && !photo) return { error: 'Write a message first.' }
  const membership = await prisma.mailMember.findUnique({
    where: { threadId_userId: { threadId, userId } },
    include: { thread: true, user: { select: { name: true, username: true } } },
  })
  if (!membership) return { error: 'That conversation is not yours.' }
  const thread = membership.thread
  let state = 'sent'
  let failReason: string | null = null
  let fromAddr: string | null = null
  let toAddr: string | null = null
  if (thread.kind === 'email') {
    const username = membership.user.username
    if (!username) return { error: 'Set a username before sending mail.' }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const sentToday = await prisma.mailMessage.count({
      where: { senderId: userId, direction: 'out', createdAt: { gt: since }, thread: { kind: 'email' } },
    })
    if (sentToday >= 30) return { error: 'Daily mail limit reached.' }
    fromAddr = mailAddress(username)
    toAddr = thread.outside
    const prior = await prisma.mailMessage.count({ where: { threadId } })
    const subject = prior > 0 && thread.subject && !thread.subject.toLowerCase().startsWith('re:')
      ? `Re: ${thread.subject}`
      : (thread.subject || '(no subject)')
    failReason = await sendCarroMail({
      from: `${display(membership.user)} <${fromAddr}>`,
      to: toAddr || '',
      subject,
      text: body || (photo ? 'Photo' : ''),
      image: photo,
    })
    state = failReason ? 'failed' : 'sent'
  }
  const message = await prisma.mailMessage.create({
    data: { threadId, senderId: userId, direction: 'out', body: body || 'Photo', image: photo, fromAddr, toAddr, state, failReason },
  })
  await prisma.mailThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } })
  await prisma.mailMember.updateMany({
    where: { threadId, userId: { not: userId } },
    data: { unread: { increment: 1 } },
  })
  await prisma.mailTyping.deleteMany({ where: { threadId, userId } })
  if (thread.kind === 'dm') await answerBot(userId, threadId, message.body)
  return {
    line: {
      id: message.id,
      from: 'me' as const,
      text: message.body,
      image: message.image,
      at: message.createdAt.getTime(),
      state: message.state,
      reason: message.failReason,
    },
  }
}

export async function receiveMail(input: { to: string; from: string; subject: string; text: string; messageId: string | null }) {
  const to = addressOf(input.to.includes('@') ? input.to : '')
  const from = addressOf(input.from)
  if (!to || !from || !to.endsWith(`@${DOMAIN}`)) return { ok: false }
  const username = localPart(to)
  if (RESERVED.has(username)) return { ok: true }
  if (input.messageId) {
    const seen = await prisma.mailMessage.findUnique({ where: { externalId: input.messageId }, select: { id: true } })
    if (seen) return { ok: true }
  }
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true },
  })
  if (!user) return { ok: true }
  const subject = clean(input.subject || '', 180) || '(no subject)'
  const body = input.text.replace(/\r/g, '').trim().slice(0, 20000) || '(empty message)'
  const threadId = await emailThread(user.id, from, subject)
  await prisma.mailMessage.create({
    data: {
      threadId,
      direction: 'in',
      body,
      fromAddr: from,
      toAddr: to,
      state: 'sent',
      externalId: input.messageId || undefined,
    },
  })
  await prisma.mailThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } })
  await prisma.mailMember.updateMany({ where: { threadId, userId: user.id }, data: { unread: { increment: 1 } } })
  return { ok: true }
}
