import { prisma } from '@/lib/prisma'
import { DESKS, deskByUsername } from '@/lib/curator/desks'
import { VOICES } from '@/lib/curator/voices'

export function botDirectory() {
  return DESKS.map((desk) => ({
    name: desk.name,
    username: desk.username,
    beat: desk.beat,
    avatar: desk.avatar,
  }))
}

export async function ensureBot(username: string): Promise<{ id: string } | null> {
  const desk = deskByUsername(username)
  if (!desk) return null
  const existing = await prisma.user.findFirst({
    where: { username: { equals: desk.username, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing) return existing
  return prisma.user.create({
    data: {
      username: desk.username,
      name: desk.name,
      email: `${desk.username}@bots.carrot.invalid`,
      profilePhoto: desk.avatar,
      image: desk.avatar,
      isOnboarded: true,
      metadata: { isBot: true, bio: desk.bio },
    },
    select: { id: true },
  })
}

export async function botReply(username: string, name: string, message: string): Promise<string> {
  const desk = deskByUsername(username)
  const beat = desk?.beat || 'the subject on this account'
  const manner = (desk && VOICES[desk.id]?.manner) || 'Plain, short, and specific.'
  const fallback = `I'm ${name}. I cover ${beat}. I won't invent a fact to answer that.`
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return fallback
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0.4,
        max_tokens: 160,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `You are ${name}, a Carrot account a person can message. Your subject is: ${beat}. Manner: ${manner}
Reply to the message in one or two sentences. Stay on that subject. If you do not know a fact, say so. Do not invent a name, a number, a date, or a quote.
Message: ${message.slice(0, 800)}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return fallback
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim()
    return text.slice(0, 500) || fallback
  } catch {
    return fallback
  }
}
