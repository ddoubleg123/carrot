'use client'

import { FormEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Download, MessageCircle, Search, ThumbsDown, ThumbsUp } from 'lucide-react'
import { formatArticle, openedPassage } from '@/lib/learn/articleText'
import RichComposer from '@/components/messaging/RichComposer'
import CommentBody from '@/components/messaging/CommentBody'
import { decodeComment, encodeComment } from '@/components/messaging/commentCodec'
import { uploadFileToFirebase } from '@/lib/uploadToFirebase'
import CFVideoPlayer from '@/components/CFVideoPlayer'
import { youtubeEmbedSrc, youtubeIdFromText } from '@/lib/youtube'

interface AskViewProps {
  patch: {
    handle: string
    name: string
  }
  initialTopicId?: string
}

interface XClip {
  handle: string
  url: string
  poster: string
  video: string
  duration: string
  note: string
}

interface XPostView {
  name: string
  handle: string
  avatar: string
  date: string
  text: string
  url: string
  photos?: string[]
  clips: XClip[]
  quote: {
    name: string
    handle: string
    date: string
    text: string
    url: string
    clips: XClip[]
  } | null
}

interface TopicSource {
  id: string
  title: string
  url: string
  domain: string
  quote: string
  summary?: string
  image?: string
  video?: string
  cfUid?: string
  origin: 'search' | 'member'
  addedByName: string
  upCount?: number
  downCount?: number
  mine?: '' | 'up' | 'down'
  postedByMe?: boolean
  notes?: { id: string; text: string; name: string; at: string }[]
}

interface TopicMessage {
  id: string
  role: 'user' | 'assistant'
  name: string
  text: string
  sourceIds: string[]
}

interface TopicReply {
  id: string
  name: string
  text: string
  createdAt: string
}

interface TopicCard {
  id: string
  question: string
  adminName: string
  note: string
  isAdmin: boolean
  slug: string
  sources: TopicSource[]
  unrelated?: TopicSource[]
  replies: TopicReply[]
  image: string | null
  pending: TopicSource[]
  messages: TopicMessage[]
  createdAt: string
}

function cardCandidates(topic: TopicCard): string[] {
  const urls: string[] = []
  const add = (url?: string | null) => {
    if (!url || !/^https?:\/\//i.test(url) || urls.includes(url)) return
    urls.push(url)
  }
  const raster = (url?: string | null) => Boolean(url && /\.(jpe?g|png|webp)(\?|$)/i.test(url))
  if (raster(topic.image) || (topic.image && topic.image.includes('i.ytimg.com'))) add(topic.image)
  for (const source of topic.sources) {
    const videoId = youtubeIdFromText(source.url) || youtubeIdFromText(source.video)
    if (videoId) add(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)
  }
  for (const source of topic.sources) {
    if (raster(source.image)) add(source.image)
  }
  add(topic.image)
  return urls
}

function cardThumb(topic: TopicCard): string {
  return cardCandidates(topic)[0] || ''
}

function CardPhoto({ src, className }: { src: string | string[]; className?: string }) {
  const list = (Array.isArray(src) ? src : [src]).filter(Boolean)
  const [index, setIndex] = useState(0)
  const current = list[index]
  if (!current) {
    return <div className={`h-full w-full bg-gradient-to-br from-[#1F2937] via-[#7C2D12] to-[#FF6A00] ${className || ''}`} />
  }
  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`h-full w-full object-cover object-[center_18%] ${className || ''}`}
      onError={() => setIndex((value) => value + 1)}
    />
  )
}

function shortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Paragraphs({ text }: { text: string }) {
  const paragraphs = formatArticle(text).flatMap((block) => block.paragraphs)
  if (paragraphs.length === 0) return null
  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-7 text-[#0B0B0F]">{paragraph}</p>
      ))}
    </div>
  )
}

function Quote({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (blocks.length === 0) return null
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <p key={index} className={block.length < 48 ? 'text-sm font-semibold text-[#0B0B0F]' : 'whitespace-pre-wrap text-sm leading-7 text-[#0B0B0F]'}>
          {block}
        </p>
      ))}
    </div>
  )
}

function sourceKind(source: TopicSource): 'video' | 'photo' | 'passage' {
  if (source.video || source.cfUid || /youtu\.be|youtube\.com/i.test(source.url)) return 'video'
  if (source.image) return 'photo'
  return 'passage'
}

function sourceTag(source: TopicSource): string {
  const year = sourceYear(source)
  const name = isPdfSource(source.url)
    ? 'PDF'
    : sourceKind(source) === 'video'
      ? 'Video'
      : sourceKind(source) === 'photo'
        ? 'Photo'
        : isXStatus(source.url)
          ? 'Post'
          : 'Passage'
  return [year ? String(year) : '', name].filter(Boolean).join(' · ')
}

function previewText(source: TopicSource): string {
  return plainPost(source.quote).split(/\n+/).map((part) => part.trim()).find((part) => part.length > 24) || plainPost(source.quote)
}

function readingSection(text: string, heading: string): string {
  const match = text.match(new RegExp(`(?:^|\\n)${heading}\\s*\\n+([\\s\\S]*?)(?=\\n+(?:Title|What the photograph shows|What it is|Why it matters)\\s*\\n+|$)`, 'i'))
  return match?.[1]?.replace(/[ \t]+/g, ' ').trim() || ''
}

function whyItMatters(source: TopicSource): string {
  if (source.summary?.trim()) return source.summary.trim()
  return readingSection(source.quote, 'Why it matters')
}

function contentLabel(source: TopicSource): string {
  const what = readingSection(source.quote, 'What the photograph shows') || readingSection(source.quote, 'What it is')
  if (what && /^the (photograph|image|picture) shows\b/i.test(source.title)) {
    const quotes = [...what.matchAll(/[“"]([^"”]{2,60})[”"]/g)].map((match) => match[1].trim()).filter(Boolean)
    if (quotes.length) {
      const name = quotes.join(' ')
      return name.length > 90 ? `${name.slice(0, 87).trim()}…` : name
    }
    const stripped = what.replace(/^the (photograph|image|picture) shows\s+/i, '').split(/(?<=[.!?])\s/)[0].replace(/\s+/g, ' ').trim()
    if (stripped.length > 24) return stripped.length > 90 ? `${stripped.slice(0, 87).trim()}…` : stripped
  }
  const line = plainPost(source.quote)
    .split(/\n+/)
    .map((part) => part.trim())
    .find((part) => part.length > 24 && !/^(what the photograph shows|why it matters)$/i.test(part))
  const sentence = line ? (line.split(/(?<=[.!?])\s+/)[0] || line) : ''
  const fromQuote = sentence.replace(/\s+/g, ' ').trim()
  const short = fromQuote.length > 90 ? `${fromQuote.slice(0, 87).trim()}…` : fromQuote
  if (isXStatus(source.url)) return short || 'Post'
  if (/^(photograph|post|video|photo)$/i.test(source.title.trim())) return short || source.title
  return source.title
}

function sourceYear(source: TopicSource): number | null {
  const match = `${source.title}\n${source.quote.slice(0, 500)}`.match(/\b(1[89]\d{2}|20[0-2]\d)\b/)
  if (!match) return null
  const year = Number(match[1])
  return year >= 1800 && year <= 2030 ? year : null
}

function spokenTranscript(raw: string): string {
  const decoded = raw.replace(/^\uFEFF/, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  const lines = decoded.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE') || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) return []
    if (/^\d+$/.test(trimmed) || trimmed.includes('-->')) return []
    const spoken = trimmed.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    return spoken.length > 1 ? [spoken] : []
  })
  const unique: string[] = []
  for (const line of lines) {
    if (unique[unique.length - 1] !== line) unique.push(line)
  }
  const blocks: string[] = []
  let current = ''
  for (const line of unique) {
    const next = current ? `${current} ${line}` : line
    if (next.length > 420 && current) {
      blocks.push(current)
      current = line
    } else {
      current = next
    }
  }
  if (current) blocks.push(current)
  return blocks.join('\n\n')
}

function SourceTools({
  source,
  busy,
  isAdmin,
  archived,
  onUpdate
}: {
  source: TopicSource
  busy: boolean
  isAdmin: boolean
  archived: boolean
  onUpdate: (action: 'vote' | 'archive' | 'restore', payload: Record<string, string>) => void
}) {
  const voteClass = (active: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm disabled:opacity-50 ${active ? 'bg-white text-[#0B0B0F] shadow-sm' : 'text-[#60646C] hover:text-[#0B0B0F]'}`
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="inline-flex items-center rounded-full border border-[#E6E8EC] bg-[#FAFAF8] p-0.5">
        <button type="button" aria-label="Up" aria-pressed={source.mine === 'up'} disabled={busy} onClick={() => onUpdate('vote', { sourceId: source.id, direction: 'up' })} className={voteClass(source.mine === 'up')}>
          <ThumbsUp className={`h-3.5 w-3.5 ${source.mine === 'up' ? 'fill-current' : ''}`} />
          {source.upCount ? <span className="text-xs tabular-nums">{source.upCount}</span> : null}
        </button>
        <button type="button" aria-label="Down" aria-pressed={source.mine === 'down'} disabled={busy} onClick={() => onUpdate('vote', { sourceId: source.id, direction: 'down' })} className={voteClass(source.mine === 'down')}>
          <ThumbsDown className={`h-3.5 w-3.5 ${source.mine === 'down' ? 'fill-current' : ''}`} />
          {source.downCount ? <span className="text-xs tabular-nums">{source.downCount}</span> : null}
        </button>
      </div>
      {isAdmin && !archived && (
        <button type="button" disabled={busy} onClick={() => onUpdate('archive', { sourceId: source.id })} className="text-sm font-medium text-[#60646C] disabled:opacity-50">
          Unrelated
        </button>
      )}
      {isAdmin && archived && (
        <button type="button" disabled={busy} onClick={() => onUpdate('restore', { sourceId: source.id })} className="text-sm font-medium text-[#60646C] disabled:opacity-50">
          Put back
        </button>
      )}
    </div>
  )
}

type Listen = { handle: string; topicId: string }

function SpokenWords({ listen, videoUrl }: { listen: Listen; videoUrl: string }) {
  const [state, setState] = useState('')
  const [text, setText] = useState('')
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const apply = (data: { state?: string; text?: string } | null) => {
      if (cancelled || !data?.state) return
      setState(data.state)
      setText(typeof data.text === 'string' ? data.text : '')
      if (data.state === 'pending') timer = window.setTimeout(() => { void load('GET') }, 5000)
    }
    const load = (method: 'POST' | 'GET') => {
      const query = `handle=${encodeURIComponent(listen.handle)}&topic=${encodeURIComponent(listen.topicId)}&url=${encodeURIComponent(videoUrl)}`
      const request = method === 'POST'
        ? fetch('/api/learn/transcript', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle: listen.handle, topic: listen.topicId, url: videoUrl })
        })
        : fetch(`/api/learn/transcript?${query}`)
      return request
        .then((response) => response.ok ? response.json() : null)
        .then(apply)
        .catch(() => { if (!cancelled) setState('failed') })
    }
    void load('POST')
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [listen.handle, listen.topicId, videoUrl])
  if (!state) return null
  return (
    <div className="border-t border-[#E6E8EC] bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-[#60646C]">Spoken in this video</p>
      {state === 'pending' && <p className="mt-2 text-sm leading-6 text-[#60646C]">Listening to the whole video. The words stay on this question when they are ready.</p>}
      {state === 'ready' && <div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#0B0B0F]">{text}</div>}
      {state === 'silent' && <p className="mt-2 text-sm leading-6 text-[#60646C]">No speech was heard in this video.</p>}
      {state === 'failed' && <p className="mt-2 text-sm leading-6 text-[#60646C]">The words could not be captured from this video.</p>}
    </div>
  )
}

function isPdfSource(url: string): boolean {
  if (url.startsWith('/topic-docs/') && !url.includes('..')) return url.toLowerCase().endsWith('.pdf')
  try {
    const parsed = new URL(url)
    return parsed.pathname.toLowerCase().endsWith('.pdf') || /\/pdf(\/|$)/i.test(parsed.pathname) || /[?&](format|type)=pdf\b/i.test(parsed.search)
  } catch {
    return false
  }
}

function archiveEmbed(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'archive.org' && !parsed.hostname.endsWith('.archive.org')) return ''
    const [slot, id] = parsed.pathname.split('/').filter(Boolean)
    if (!id || (slot !== 'details' && slot !== 'embed' && slot !== 'stream')) return ''
    return `https://archive.org/embed/${encodeURIComponent(id)}`
  } catch {
    return ''
  }
}

function pdfFrameSrc(url: string): string {
  if (url.startsWith('/topic-docs/') && !url.includes('..')) {
    return `/api/learn/pdf?file=${encodeURIComponent(url.slice('/topic-docs/'.length))}`
  }
  return `/api/learn/pdf?url=${encodeURIComponent(url)}`
}

function PdfView({ url, title }: { url: string; title: string }) {
  const base = pdfFrameSrc(url)
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState<string[] | null>(null)
  const [hits, setHits] = useState<number[]>([])
  const [at, setAt] = useState(0)
  const [status, setStatus] = useState('')
  const page = hits[at]
  const src = page ? `${base}#page=${page}` : `${base}#view=FitH`
  const find = async (value: string) => {
    const needle = value.trim().toLowerCase()
    if (needle.length < 2) return
    setStatus('Searching…')
    let list = pages
    if (!list) {
      const response = await fetch(`${base}${base.includes('?') ? '&' : '?'}pages=1`).catch(() => null)
      const data = response?.ok ? await response.json().catch(() => null) : null
      list = Array.isArray(data?.pages) ? data.pages.filter((item: unknown): item is string => typeof item === 'string') : []
      setPages(list)
    }
    const found = (list ?? []).flatMap((text, index) => text.toLowerCase().includes(needle) ? [index + 1] : [])
    setHits(found)
    setAt(0)
    setStatus(found.length ? '' : 'No matches in this PDF.')
  }
  return (
    <div className="mt-3">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void find(query) }}>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E6E8EC] bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-[#60646C]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this PDF" className="h-full w-full bg-transparent text-sm outline-none" />
        </label>
        <button type="submit" disabled={query.trim().length < 2} className="h-10 rounded-full bg-[#0B0B0F] px-4 text-sm font-semibold text-white disabled:opacity-50">Find</button>
        {hits.length > 0 && (
          <span className="inline-flex items-center gap-1 text-sm text-[#60646C]">
            <button type="button" aria-label="Previous match" onClick={() => setAt((index) => (index - 1 + hits.length) % hits.length)} className="rounded-full p-1 hover:bg-[#F4F5F7]"><ChevronLeft className="h-4 w-4" /></button>
            <span className="tabular-nums">Page {page}</span>
            <button type="button" aria-label="Next match" onClick={() => setAt((index) => (index + 1) % hits.length)} className="rounded-full p-1 hover:bg-[#F4F5F7]"><ChevronRight className="h-4 w-4" /></button>
          </span>
        )}
        <a href={`${base}${base.includes('?') ? '&' : '?'}dl=1`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#E6E8EC] bg-white px-3 text-sm font-semibold text-[#0B0B0F]">
          <Download className="h-4 w-4" />
          Download
        </a>
      </form>
      {status ? <p className="mt-2 text-sm text-[#60646C]">{status}</p> : null}
      <iframe key={src} title={title} src={src} className="mt-2 h-[75vh] min-h-[32rem] w-full rounded-[14px] border border-[#E6E8EC] bg-[#525659]" />
    </div>
  )
}

function isXStatus(url: string): boolean {
  return /(?:^https?:\/\/)?(?:www\.)?(?:mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(url)
}

function plainPost(text: string): string {
  return text.replace(/https?:\/\/\S+/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function XPostBody({ url, fallback, query = '', listen }: { url: string; fallback: string; query?: string; listen?: Listen }) {
  const [post, setPost] = useState<XPostView | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/learn/post?url=${encodeURIComponent(url)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data?.post?.text) setPost(data.post) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [url])
  const text = post?.text || plainPost(fallback)
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const shown = lines.length ? lines : [text]
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[#60646C]">Post{post?.date ? ` · ${post.date}` : ''}</p>
      {shown.map((line, index) => (
        <p key={index} data-line={index} className="mt-3 text-[15px] leading-7 text-[#0B0B0F]">{markQuery(line, query, query.trim().length >= 2 && line.toLowerCase().includes(query.trim().toLowerCase()))}</p>
      ))}
      {(post?.photos || []).map((src) => (
        <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="mt-3 max-h-80 w-full rounded-[14px] bg-[#F4F5F7] object-contain" />
      ))}
      {(post?.clips || []).map((clip) => (
        <XClipView key={clip.video} clip={clip} listen={listen} />
      ))}
      {post?.quote && (post.quote.text || post.quote.clips.length > 0) && (
        <div className="mt-3 rounded-[14px] border border-[#E6E8EC] p-3">
          <span className="text-xs uppercase tracking-wide text-[#60646C]">{post.quote.date ? `Quoted post · ${post.quote.date}` : 'Quoted post'}</span>
          {post.quote.text && <p className="mt-2 text-[15px] leading-7">{post.quote.text}</p>}
          {post.quote.clips.map((clip) => <XClipView key={clip.video} clip={clip} listen={listen} />)}
        </div>
      )}
      <a href={post?.url || url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-[#FF6A00]">x.com</a>
    </div>
  )
}

function XClipView({ clip, listen }: { clip: XClip; listen?: Listen }) {
  const player = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-[#E6E8EC] bg-black">
      <div className="relative">
        <video
          ref={player}
          controls
          playsInline
          preload="none"
          poster={clip.poster || undefined}
          src={`/api/learn/media?url=${encodeURIComponent(clip.video)}`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="max-h-[28rem] min-h-48 w-full bg-black"
        />
        {!playing && (
          <button
            type="button"
            aria-label="Play video"
            onClick={() => { void player.current?.play() }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/75 text-sm font-semibold text-white">Play</span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm">
        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#FF6A00]">Video</a>
        <span className="text-[#60646C]">{[clip.duration, clip.note].filter(Boolean).join(' · ')}</span>
      </div>
      {listen && <SpokenWords listen={listen} videoUrl={clip.video} />}
    </div>
  )
}

function SourceNotes({
  source,
  canNote,
  busy,
  onNote
}: {
  source: TopicSource
  canNote?: boolean
  busy?: boolean
  onNote?: (text: string) => Promise<boolean>
}) {
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const notes = source.notes || []
  if (!notes.length && !canNote) return null
  return (
    <div className="mt-4 space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="rounded-[14px] bg-[#FFF8F1] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#9A3412]">Note · {note.name}</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-[#0B0B0F]">{note.text}</p>
        </div>
      ))}
      {canNote && !writing && (
        <button type="button" onClick={() => setWriting(true)} className="text-sm font-medium text-[#60646C]">Add a note</button>
      )}
      {canNote && writing && (
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault()
          if (!text.trim() || !onNote) return
          const saved = await onNote(text.trim())
          if (saved) {
            setText('')
            setWriting(false)
          }
        }}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Point to a page or a line. The source stays as it is." className="w-full resize-none rounded-2xl border border-[#E6E8EC] bg-white p-3 text-sm leading-6 outline-none focus:border-[#FF6A00]" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || text.trim().length < 1} className="rounded-full bg-[#0B0B0F] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">Add note</button>
            <button type="button" onClick={() => { setWriting(false); setText('') }} className="text-sm text-[#60646C]">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

function SourceCard({
  source,
  children,
  listen,
  open: openProp,
  onToggle,
  canNote,
  busy,
  onNote
}: {
  source: TopicSource
  children?: ReactNode
  listen?: Listen
  open?: boolean
  onToggle?: () => void
  canNote?: boolean
  busy?: boolean
  onNote?: (text: string) => Promise<boolean>
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const [full, setFull] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [transcript, setTranscript] = useState('')
  const open = openProp ?? localOpen
  const toggle = onToggle ?? (() => setLocalOpen((value) => !value))
  const captionUrl = source.video?.startsWith('/topic-videos/') && source.video.toLowerCase().endsWith('.mp4')
    ? source.video.replace(/\.mp4$/i, '.en.vtt')
    : ''
  useEffect(() => {
    if (!open || !expanded || !captionUrl || transcript) return
    let cancelled = false
    fetch(captionUrl)
      .then((response) => response.ok ? response.text() : '')
      .then((text) => {
        if (cancelled || !text) return
        const spoken = spokenTranscript(text)
        if (spoken.length > source.quote.length) setTranscript(spoken)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [open, expanded, captionUrl, source.quote.length, transcript])
  const external = source.url.startsWith('http')
  const hosted = source.video && !youtubeIdFromText(source.video) ? source.video : ''
  const youtube = !source.cfUid && !hosted ? (youtubeIdFromText(source.url) || youtubeIdFromText(source.video)) : null
  const archive = !source.cfUid && !hosted && !youtube ? archiveEmbed(source.url) : ''
  const pdf = !archive && isPdfSource(source.url)
  const xStatus = isXStatus(source.url) && !hosted && !source.cfUid && !youtube
  const photo = source.image || (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(source.url) ? source.url : '')
  const longQuote = (source.video || source.cfUid) && source.quote.length > 280
  const label = contentLabel(source)
  const passage = openedPassage(source.quote)
  const summaryText = whyItMatters(source)
  const summary = summaryText && !/^[a-z]/.test(summaryText.trim()) && !passage.toLowerCase().includes(summaryText.trim().slice(0, 48).toLowerCase()) ? summaryText : ''
  return (
    <article id={`source-${source.id}`} className="scroll-mt-24 border-b border-[#E6E8EC]">
      <button type="button" onClick={toggle} className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 py-3.5 text-left sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#FF6A00]">{sourceTag(source)}</span>
        <span className={`min-w-0 font-medium text-[#0B0B0F] ${open ? '' : 'truncate'}`}>{label}</span>
        <span className="hidden truncate text-[13px] text-[#8A8F98] sm:block">{source.domain}</span>
      </button>
      {open && (
      <div className="pb-4 sm:pl-[6.7rem]">
      {source.cfUid ? (
        <CFVideoPlayer uid={source.cfUid} autoPlay={false} muted={false} loop={false} controls poster={photo || undefined} />
      ) : null}
      {hosted ? (
        <>
          <video src={hosted} controls playsInline preload="metadata" poster={photo || undefined} className="mt-1 max-h-[28rem] w-full rounded-[14px] bg-black" />
          {listen && hosted.startsWith('/topic-videos/') && hosted.toLowerCase().endsWith('.mp4') && (
            <SpokenWords listen={listen} videoUrl={hosted} />
          )}
        </>
      ) : null}
      {youtube ? (
        <div className="mt-1 aspect-video w-full overflow-hidden rounded-[14px] bg-black">
          <iframe title={label} src={youtubeEmbedSrc(youtube, false)} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      ) : null}
      {archive ? (
        <iframe title={label} src={archive} className="mt-1 h-[75vh] min-h-[32rem] w-full rounded-[14px] border border-[#E6E8EC] bg-white" allowFullScreen />
      ) : null}
      {!source.cfUid && !hosted && !youtube && !archive && photo ? (
        <button type="button" onClick={() => setFull(true)} className="mt-1 block w-full bg-[#F4F5F7]">
          <img src={photo} alt="" referrerPolicy="no-referrer" className="mx-auto max-h-[28rem] w-full object-contain" />
        </button>
      ) : null}
      {full && photo && (
        <div className="fixed inset-0 z-[80] overflow-auto bg-black/90" onClick={() => setFull(false)}>
          <button type="button" className="sticky top-4 z-10 ml-auto mr-4 mt-4 block rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0B0B0F]" onClick={() => setFull(false)}>
            Close
          </button>
          <img src={photo} alt="" className="mx-auto mb-10 w-auto max-w-[96vw]" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
        {xStatus ? <div className="mt-3"><XPostBody url={source.url} fallback={source.quote} listen={listen} /></div> : (
            <>
              {summary && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-[#60646C]">Why it matters</p>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-[#0B0B0F]">{summary}</p>
                </div>
              )}
              {pdf ? <PdfView url={source.url} title={label} /> : (
                <div className={longQuote && !expanded ? 'mt-3 max-h-72 overflow-y-auto pr-1' : 'mt-3'}>
                  <Quote text={expanded && transcript ? transcript : passage} />
                </div>
              )}
              {!pdf && longQuote && (
                <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 rounded-full border border-[#E6E8EC] bg-white px-3.5 py-2 text-sm">
                  {expanded ? 'Shorter excerpt' : 'Full transcript'}
                </button>
              )}
            </>
          )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {external && (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#FF6A00]">
              {source.domain || 'Source link'}
            </a>
          )}
          {source.url.startsWith('/topic-docs/') && !source.url.includes('..') && (
            <a href={`${pdfFrameSrc(source.url)}&dl=1`} className="text-sm font-medium text-[#FF6A00]">
              PDF file
            </a>
          )}
        </div>
        <SourceNotes source={source} canNote={canNote} busy={busy} onNote={onNote} />
        {children}
      </div>
      )}
    </article>
  )
}

function sourcePhoto(source: TopicSource): string {
  if (!source.image) return ''
  return source.image.startsWith('/') ? source.image : `/api/img?url=${encodeURIComponent(source.image)}`
}

function SourceTimeline({ sources, onOpen }: { sources: TopicSource[]; onOpen?: (id: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, x: 0, left: 0, moved: false })
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [active, setActive] = useState('')
  const [zoom, setZoom] = useState(1)
  const lanes = [
    ['video', 'Video', '#7C3AED'],
    ['photo', 'Photos', '#0284C7'],
    ['passage', 'Passages', '#C2410C']
  ] as const
  const dated = sources.flatMap((source) => {
    const year = sourceYear(source)
    return year ? [{ source, year, kind: sourceKind(source) }] : []
  }).sort((a, b) => a.year - b.year || lanes.findIndex(([kind]) => kind === a.kind) - lanes.findIndex(([kind]) => kind === b.kind))
  const visible = dated.filter((item) => !hidden[item.kind])
  const present = lanes.filter(([kind]) => dated.some((item) => item.kind === kind))
  const slot = Math.round(168 * zoom)
  const cardWidth = Math.max(96, slot - 20)
  const trackWidth = Math.max(visible.length * slot + 48, slot + 48)
  const open = (id: string) => {
    if (drag.current.moved) {
      drag.current.moved = false
      return
    }
    setActive(id)
    onOpen?.(id)
    window.setTimeout(() => {
      const card = document.getElementById(`source-${id}`)
      if (!card) return
      card.scrollIntoView({ behavior: 'smooth', block: 'start' })
      card.classList.add('ring-2', 'ring-[#E24B3B]')
      window.setTimeout(() => card.classList.remove('ring-2', 'ring-[#E24B3B]'), 1600)
    }, 40)
  }
  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        setZoom((current) => Math.min(3.2, Math.max(0.75, current + (event.deltaY < 0 ? 0.12 : -0.12))))
        return
      }
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault()
        node.scrollLeft += event.deltaY
      }
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [visible.length])
  if (dated.length === 0) return null
  return (
    <section id="timeline" className="mt-6 rounded-[20px] border border-[#E6E8EC] bg-[#F7F4EF] px-4 py-3 text-[#0B0B0F]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold tracking-tight">Timeline</h3>
        <div className="ml-auto flex items-center gap-1">
          {present.map(([kind, label, color]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={!hidden[kind]}
              onClick={() => setHidden((current) => ({ ...current, [kind]: !current[kind] }))}
              className={`rounded-full border border-[#E6E8EC] bg-white px-2.5 py-1 text-xs ${hidden[kind] ? 'text-[#9CA3AF]' : ''}`}
            >
              <i className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
              {label}
            </button>
          ))}
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((current) => Math.max(0.75, Number((current - 0.2).toFixed(2))))} className="ml-1 h-7 w-7 rounded-full border border-[#E6E8EC] bg-white text-sm">−</button>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((current) => Math.min(3.2, Number((current + 0.2).toFixed(2))))} className="h-7 w-7 rounded-full border border-[#E6E8EC] bg-white text-sm">+</button>
        </div>
      </div>
      <div
        ref={scroller}
        className="mt-2 h-[250px] overflow-x-auto overflow-y-hidden"
        onPointerDown={(event) => {
          const node = scroller.current
          if (!node) return
          drag.current = { active: true, x: event.clientX, left: node.scrollLeft, moved: false }
        }}
        onPointerMove={(event) => {
          const node = scroller.current
          if (!node || !drag.current.active) return
          const delta = event.clientX - drag.current.x
          if (Math.abs(delta) < 6) return
          drag.current.moved = true
          node.scrollLeft = drag.current.left - delta
        }}
        onPointerUp={() => { drag.current.active = false }}
        onPointerCancel={() => { drag.current.active = false }}
      >
        <div className="relative h-full" style={{ width: trackWidth }}>
          <div className="pointer-events-none absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#E24B3B]" />
          {visible.map((item, index) => {
            const above = index % 2 === 0
            const photo = sourcePhoto(item.source)
            const color = lanes.find(([kind]) => kind === item.kind)?.[2] || '#C2410C'
            return (
              <button
                key={item.source.id}
                type="button"
                aria-label={`Open ${item.year}: ${contentLabel(item.source)}`}
                onClick={() => open(item.source.id)}
                className={`absolute z-10 flex cursor-pointer flex-col items-center ${above ? 'bottom-1/2' : 'top-1/2'}`}
                style={{ left: 24 + index * slot, width: cardWidth }}
              >
                {above ? null : <span className="h-3 w-px bg-[#E24B3B]" />}
                <span className={`h-12 w-12 overflow-hidden rounded-full border-2 bg-white transition hover:scale-105 ${active === item.source.id ? 'border-[#0B0B0F]' : 'border-white'} shadow-sm`} style={{ boxShadow: `0 0 0 3px ${color}` }}>
                  {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full" style={{ background: color }} />}
                </span>
                <span className="mt-1 text-xs font-semibold text-[#E24B3B]">{item.year}</span>
                <span className="line-clamp-2 w-full px-1 text-center text-[11px] leading-4 text-[#3F3F46]">{contentLabel(item.source)}</span>
                {above ? <span className="mt-1 h-3 w-px bg-[#E24B3B]" /> : null}
              </button>
            )
          })}
          {visible.map((item, index) => (
            <span key={`${item.source.id}-dot`} className="pointer-events-none absolute top-1/2 z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#E24B3B]" style={{ left: 24 + index * slot + cardWidth / 2 }} />
          ))}
        </div>
      </div>
    </section>
  )
}

function replyParent(reply: TopicReply): string | undefined {
  return decodeComment(reply.text).parentId
}

function TopicThread({
  reply,
  replies,
  depth,
  onReply
}: {
  reply: TopicReply
  replies: TopicReply[]
  depth: number
  onReply: (reply: TopicReply) => void
}) {
  const children = replies.filter((item) => replyParent(item) === reply.id)
  return (
    <div className={depth > 0 ? 'ml-6 border-l border-orange-100 pl-3' : ''}>
      <div className="rounded-2xl border border-[#E6E8EC] bg-white p-4">
        <p className="text-sm font-semibold text-[#0B0B0F]">{reply.name}{reply.createdAt ? ` · ${shortDate(reply.createdAt)}` : ''}</p>
        <div className="mt-2 text-sm text-[#0B0B0F]">
          <CommentBody content={reply.text} />
        </div>
        <button type="button" className="mt-2 text-xs font-medium text-[#FF6A00]" onClick={() => onReply(reply)}>
          Reply
        </button>
      </div>
      {children.length > 0 && (
        <div className="mt-3 space-y-3">
          {children.map((child) => (
            <TopicThread key={child.id} reply={child} replies={replies} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  )
}

function playableCopy(url: string): boolean {
  if (url.startsWith('/topic-videos/') && !url.includes('..') && url.toLowerCase().split('?')[0].endsWith('.mp4')) return true
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (host.endsWith('youtube.com') || host === 'youtu.be' || host.endsWith('googlevideo.com')) return false
    return parsed.pathname.toLowerCase().endsWith('.mp4')
      || host.endsWith('firebasestorage.googleapis.com')
      || host.endsWith('firebasestorage.app')
      || host.endsWith('storage.googleapis.com')
      || host.endsWith('videodelivery.net')
      || host.endsWith('cloudflarestream.com')
      || (host === 'localhost' && parsed.pathname.toLowerCase().endsWith('.mp4'))
  } catch {
    return false
  }
}

function captionTrack(pool: unknown): string {
  if (!pool || typeof pool !== 'object') return ''
  const tracks = pool as Record<string, unknown>
  const preferred = tracks.en || tracks['en-US'] || tracks['en-orig'] || Object.values(tracks)[0]
  const list = Array.isArray(preferred) ? preferred : []
  const match = list.find((item) => item && typeof item === 'object' && (item as { ext?: string }).ext === 'vtt' && typeof (item as { url?: string }).url === 'string')
    || list.find((item) => item && typeof item === 'object' && typeof (item as { url?: string }).url === 'string')
  return match && typeof (match as { url?: string }).url === 'string' ? (match as { url: string }).url : ''
}

function VideoAdd({ busy, onSave }: { busy: boolean; onSave: (payload: Record<string, string>) => Promise<boolean> }) {
  const [url, setUrl] = useState('')
  const [rights, setRights] = useState(false)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const start = async (event: FormEvent) => {
    event.preventDefault()
    const pageUrl = url.trim()
    if (!pageUrl || !rights || working || busy) return
    setWorking(true)
    setFailed(false)
    setProgress(0)
    setMessage('Saving a copy we can play. This can take a minute.')
    const started = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl, local: true })
    })
    const startedData = await started.json().catch(() => null)
    const jobId = startedData?.job?.id
    if (!started.ok || !jobId || startedData?.job?.status === 'error' || startedData?.job?.status === 'failed') {
      setWorking(false)
      setFailed(true)
      setProgress(null)
      const reason = typeof startedData?.job?.error === 'string' ? startedData.job.error : 'The copy service did not start.'
      setMessage(`The video was not added. ${reason}`)
      return
    }
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2000))
      const status = await fetch(`/api/ingest?jobId=${encodeURIComponent(jobId)}&t=${Date.now()}`, { cache: 'no-store' })
      const data = await status.json().catch(() => null)
      const job = data?.job
      if (!status.ok || !job) {
        if (status.status === 404) {
          setWorking(false)
          setFailed(true)
          setProgress(null)
          setMessage('The video was not added. The save was interrupted. Try again.')
          return
        }
        continue
      }
      if (typeof job.progress === 'number') setProgress(job.progress)
      if (job.status === 'failed') {
        setWorking(false)
        setFailed(true)
        setProgress(null)
        setMessage('The video was not added. The copy service could not save it.')
        return
      }
      const copy = typeof job.videoUrl === 'string' && playableCopy(job.videoUrl)
        ? job.videoUrl
        : typeof job.mediaUrl === 'string' && playableCopy(job.mediaUrl) ? job.mediaUrl : ''
      const cfUid = typeof job.cfUid === 'string' ? job.cfUid : ''
      const finished = job.status === 'completed' || job.status === 'succeeded'
      if (finished && (copy || /^[A-Za-z0-9]{16,40}$/.test(cfUid))) {
        const saved = await onSave({
          pageUrl,
          videoUrl: copy,
          cfUid,
          title: typeof job.title === 'string' ? job.title : '',
          thumbnail: typeof job.thumbnail === 'string' ? job.thumbnail : '',
          captionUrl: captionTrack(job.subtitles) || captionTrack(job.automaticCaptions),
          transcript: typeof job.transcript === 'string' ? job.transcript : '',
          rights: 'true'
        })
        setWorking(false)
        setFailed(!saved)
        setProgress(null)
        if (saved) {
          setUrl('')
          setRights(false)
          setMessage('Added. It plays on this question.')
        } else {
          setMessage('The video was not added. The copy was made, but it could not be saved on this question.')
        }
        return
      }
      if (finished) {
        setWorking(false)
        setFailed(true)
        setProgress(null)
        setMessage('The video was not added. The copy service finished without a file we can play.')
        return
      }
    }
    setWorking(false)
    setFailed(true)
    setProgress(null)
    setMessage('The video was not added. Saving it took too long.')
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={start}>
      <p className="text-sm leading-6 text-[#60646C]">Paste a video link</p>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.youtube.com/watch?v="
        className="h-11 w-full rounded-full border border-[#E6E8EC] px-4 text-sm outline-none focus:border-[#FF6A00]"
      />
      <label className="flex items-start gap-2 text-sm text-[#0B0B0F]">
        <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-1" />
        <span>I have the rights to ingest and repost this video.</span>
      </label>
      <button type="submit" disabled={busy || working || !rights || !url.trim()} className="h-11 w-full rounded-full bg-[#0B0B0F] px-4 text-sm font-semibold text-white disabled:opacity-50">
        {working ? 'Saving the video…' : 'Add video'}
      </button>
      {working && (
        <p className="mt-3 text-sm text-[#60646C]">
          {message}{typeof progress === 'number' ? ` ${Math.round(progress)}%` : ''}
        </p>
      )}
      {!working && failed && message && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#FDBA74] bg-[#FFF7ED] px-4 py-3" role="status">
          <div className="min-w-0 flex-1">
            <strong className="block text-sm text-[#0B0B0F]">Video not added</strong>
            <span className="text-sm text-[#60646C]">{message.replace(/^The video was not added\.\s*/, '')}</span>
          </div>
          <button type="submit" disabled={busy || !rights || !url.trim()} className="rounded-full border border-[#E6E8EC] bg-white px-3.5 py-2 text-sm font-semibold">
            Retry
          </button>
        </div>
      )}
      {!working && !failed && message && <p className="mt-3 text-sm text-[#60646C]">{message}</p>}
    </form>
  )
}

function markQuery(line: string, query: string, active: boolean) {
  const needle = query.trim()
  if (needle.length < 2) return line
  const lower = line.toLowerCase()
  const folded = needle.toLowerCase()
  const nodes: ReactNode[] = []
  let from = 0
  let found = lower.indexOf(folded, from)
  let key = 0
  while (found >= 0) {
    if (found > from) nodes.push(line.slice(from, found))
    nodes.push(<mark key={key++} className={active ? 'rounded-sm bg-[#FF6A00] text-white' : 'rounded-sm bg-[#FFE08A]'}>{line.slice(found, found + needle.length)}</mark>)
    from = found + needle.length
    found = lower.indexOf(folded, from)
  }
  if (!nodes.length) return line
  if (from < line.length) nodes.push(line.slice(from))
  return nodes
}

function DocumentReview({
  source,
  kept,
  busy,
  onSaveAll,
  onKeep,
  onReject,
  listen
}: {
  source: TopicSource
  kept: boolean
  busy: boolean
  onSaveAll: () => void
  onKeep: (quote: string) => void
  onReject?: () => void
  listen?: Listen
}) {
  const docRef = useRef<HTMLDivElement>(null)
  const keptText = useRef('')
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const [selection, setSelection] = useState('')
  const lines = source.quote.split(/\n+/).map((part) => part.trim()).filter(Boolean)
  const body = lines.length ? lines : [source.quote]
  const hits = query.trim().length < 2 ? [] : body.flatMap((line, index) => line.toLowerCase().includes(query.trim().toLowerCase()) ? [index] : [])
  useEffect(() => { setAt(0) }, [query])
  useEffect(() => {
    const onSelect = () => {
      const picked = window.getSelection()
      const text = picked?.toString().trim() || ''
      const node = picked?.anchorNode
      const inside = !!node && !!docRef.current?.contains(node)
      const next = inside && text.length >= 8 ? text : ''
      keptText.current = next
      setSelection(next)
    }
    document.addEventListener('selectionchange', onSelect)
    return () => document.removeEventListener('selectionchange', onSelect)
  }, [])
  function jump(advance: boolean) {
    const needle = query.trim().toLowerCase()
    const nodes = needle.length < 2 ? [] : [...(docRef.current?.querySelectorAll<HTMLElement>('[data-line]') || [])].filter((node) => node.textContent?.toLowerCase().includes(needle))
    const marks = nodes.length ? nodes : []
    if (!marks.length && !hits.length) return
    const index = advance ? (at + 1) % Math.max(marks.length || hits.length, 1) : at
    setAt(index)
    const target = marks[index] || docRef.current?.querySelector(`[data-line="${hits[index]}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-[#E6E8EC] bg-white">
      <div className="flex items-center gap-2 border-b border-[#E6E8EC] px-3 py-2">
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-[#0B0B0F]">{source.domain || source.title}</strong>
          {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-[#9a3412]">{source.url}</a> : <span className="block truncate text-xs text-[#60646C]">No page address</span>}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); jump(true) } }}
          placeholder="Search this document"
          aria-label="Search this document"
          className="h-9 w-44 rounded-full border border-[#E6E8EC] bg-[#FAFAF8] px-3 text-sm outline-none focus:border-[#FF6A00]"
        />
        <button type="button" onClick={() => jump(true)} className="h-9 rounded-full border border-[#E6E8EC] px-3 text-sm font-semibold">Next</button>
        <span className="w-10 text-xs text-[#60646C]">{hits.length ? `${(at % hits.length) + 1}/${hits.length}` : ''}</span>
        {onReject && !kept && (
          <button type="button" disabled={busy} onClick={onReject} className="h-9 whitespace-nowrap rounded-full border border-[#E6E8EC] px-3 text-sm font-semibold disabled:opacity-50">Reject</button>
        )}
        <button
          type="button"
          disabled={busy || selection.length < 8}
          title="Highlight a passage in the card, then save only those words"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const quote = keptText.current
            if (quote.length < 8) return
            onKeep(quote)
            keptText.current = ''
            setSelection('')
          }}
          className="h-9 whitespace-nowrap rounded-full border border-[#E6E8EC] px-3 text-sm font-semibold disabled:opacity-35"
        >
          Save selection
        </button>
        <button type="button" disabled={busy || kept || !source.id} onClick={onSaveAll} className="h-9 whitespace-nowrap rounded-full bg-[#0B0B0F] px-3 text-sm font-semibold text-white disabled:opacity-50">{kept ? 'Saved' : 'Save'}</button>
      </div>
      <div ref={docRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isXStatus(source.url) ? <XPostBody url={source.url} fallback={source.quote} query={query} listen={listen} /> : (
          <>
            <h3 className="text-xl font-semibold tracking-tight text-[#0B0B0F]">{isPdfSource(source.url) ? contentLabel(source) : source.title}</h3>
            {isPdfSource(source.url) ? <PdfView url={source.url} title={contentLabel(source)} /> : body.map((line, index) => (
              <p key={index} data-line={index} className="mt-3 text-[15px] leading-7 text-[#0B0B0F]">{markQuery(line, query, hits[at % Math.max(hits.length, 1)] === index)}</p>
            ))}
          </>
        )}
      </div>
    </article>
  )
}

function TopicRoom({
  topic,
  busy,
  mode,
  setMode,
  followUp,
  setFollowUp,
  link,
  setLink,
  lookFor,
  setLookFor,
  written,
  setWritten,
  dragging,
  setDragging,
  onBack,
  patchHandle,
  patchName,
  onUpdate,
  onUpload,
  onUploadPdfs,
  notice,
  error,
  dock
}: {
  topic: TopicCard
  busy: boolean
  mode: 'ask' | 'photo' | 'link' | 'video' | 'write' | 'files'
  setMode: (mode: 'ask' | 'photo' | 'link' | 'video' | 'write' | 'files') => void
  followUp: string
  setFollowUp: (value: string) => void
  link: string
  setLink: (value: string) => void
  lookFor: string
  setLookFor: (value: string) => void
  written: string
  setWritten: (value: string) => void
  dragging: boolean
  setDragging: (value: boolean) => void
  onBack: () => void
  patchHandle: string
  patchName: string
  onUpdate: (action: 'reply' | 'source' | 'image' | 'search' | 'approve' | 'deny' | 'ask' | 'text' | 'video' | 'clip' | 'vote' | 'archive' | 'restore' | 'addendum', payload: Record<string, string>) => Promise<boolean>
  onUpload: (file: File) => void
  onUploadPdfs: (files: File[]) => void
  notice: string
  error: string
  dock: HTMLElement | null
}) {
  const [replyTo, setReplyTo] = useState<TopicReply | null>(null)
  const [copied, setCopied] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [reviewTab, setReviewTab] = useState<'results' | 'earlier'>('results')
  const listen = { handle: patchHandle, topicId: topic.id }
  const [showUnrelated, setShowUnrelated] = useState(false)
  const [openSources, setOpenSources] = useState<string[]>([])
  const toggleSource = (id: string) => {
    setOpenSources((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }
  const revealSource = (id: string) => {
    setOpenSources((current) => current.includes(id) ? current : [...current, id])
  }
  const saved = useRef<HTMLElement>(null)
  const reviewRow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (notice) saved.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [notice, topic.sources.length])
  useEffect(() => {
    if (!showHistory) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHistory(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHistory])
  const tiles = [
    ['ask', 'Search', 'Ask for a passage'],
    ['photo', 'Media', 'A picture or video'],
    ['link', 'Page', 'Read a link'],
    ['files', 'Files', 'Drop PDFs'],
    ['video', 'Video', 'A copy we host'],
    ['write', 'Write', 'Something you know']
  ] as const
  const sections = topic.sources.some((source) => sourceYear(source))
    ? ['timeline', 'record', 'add', 'discussion']
    : ['record', 'add', 'discussion']
  const messages = topic.messages || []
  const pending = topic.pending || []
  const mentioned = new Set(messages.flatMap((message) => message.sourceIds))
  const loose = pending.filter((source) => !mentioned.has(source.id))
  const findSource = (id: string) => pending.find((source) => source.id === id) || topic.sources.find((source) => source.id === id) || null
  const latestIndex = messages.reduce((found, message, index) => message.role === 'assistant' ? index : found, -1)
  const latest = latestIndex >= 0 ? messages[latestIndex] : null
  const asked = latestIndex > 0 && messages[latestIndex - 1]?.role === 'user' ? messages[latestIndex - 1] : null
  const earlierMessages = messages.slice(0, asked ? latestIndex - 1 : Math.max(latestIndex, 0))
  const latestWaiting = (latest?.sourceIds || []).flatMap((sourceId) => {
    const source = pending.find((item) => item.id === sourceId)
    return source && !topic.sources.some((item) => item.id === sourceId) ? [source] : []
  })
  const latestDocs = (latest?.sourceIds || []).flatMap((sourceId) => {
    const source = findSource(sourceId)
    return source ? [source] : []
  })

  return (
    <article id="question-top" className="mx-auto mt-2 max-w-5xl">
      <div className="flex items-center justify-between gap-3 bg-white py-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#60646C]">
          <ArrowLeft className="h-4 w-4" />
          Questions
        </button>
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">{patchName}</span>
        <button
          type="button"
          onClick={async () => {
            const url = `${window.location.origin}/patch/${patchHandle}/${topic.slug || topic.id}`
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            } catch {
              setCopied(false)
            }
          }}
          className="h-10 shrink-0 rounded-full bg-[#FF6A00] px-4 text-sm font-semibold text-white"
        >
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-[#141414]">
                <CardPhoto src={cardCandidates(topic)} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.7rem] font-semibold leading-tight tracking-tight text-[#0B0B0F] md:text-[2rem]">{topic.question}</h2>
          <p className="mt-2 text-sm text-[#60646C]">{topic.adminName}{topic.isAdmin ? ' · You started this' : ''} <span title="Sources are the quoted record. Comments are discussion. A claim inside a source is not a finding." className="ml-1 rounded-full border border-[#E6E8EC] px-2 py-0.5 text-xs text-[#3F3F46]">Quotes only</span></p>
        </div>
      </div>
      {topic.note.trim() && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#0B0B0F]">{topic.note}</p>
      )}

      <section className="mt-5 rounded-2xl border-l-4 border-[#8A8F98] bg-[#F7F4EF] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#6B7079]">Not checked yet</p>
        <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-[#0B0B0F]">{topic.sources.length} {topic.sources.length === 1 ? 'source' : 'sources'} in the record. The quotes have not been checked against this question.</h3>
      </section>
      <nav className="mt-4 flex flex-wrap gap-2">
        {sections.map((id) => (
          <button key={id} type="button" onClick={() => {
            if (id === 'add') {
              setMode('ask')
              document.getElementById('add')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              window.setTimeout(() => document.getElementById('topic-ask')?.focus(), 300)
              return
            }
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }} className={`rounded-full border border-[#E6E8EC] bg-white px-3.5 py-2 text-sm font-semibold capitalize ${id === 'add' ? 'lg:hidden' : ''}`}>
            {id}
          </button>
        ))}
      </nav>
      <SourceTimeline sources={topic.sources} onOpen={revealSource} />
      <section id="record" ref={saved} className="mt-8">
        {notice && <p className="mb-3 text-sm font-medium text-[#0B0B0F]">{notice}</p>}
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#0B0B0F]">Sources <span className="ml-2 font-medium normal-case tracking-normal text-[#60646C]">{topic.sources.length}</span></h3>
        <div className="mt-2 border-t border-[#E6E8EC]">
          {topic.sources.map((source) => (
            <SourceCard key={source.id} source={source} listen={listen} open={openSources.includes(source.id)} onToggle={() => toggleSource(source.id)} canNote={topic.isAdmin || source.postedByMe} busy={busy} onNote={(text) => onUpdate('addendum', { sourceId: source.id, text })}>
              <SourceTools source={source} busy={busy} isAdmin={topic.isAdmin} archived={false} onUpdate={onUpdate} />
            </SourceCard>
          ))}
          {topic.sources.length === 0 && <p className="text-sm text-[#60646C]">Nothing saved yet.</p>}
        </div>
      </section>

      {(topic.unrelated || []).length > 0 && (
        <section id="unrelated" className="mt-8">
          <button
            type="button"
            aria-expanded={showUnrelated}
            onClick={() => setShowUnrelated((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#E6E8EC] bg-[#FAFAF8] px-4 py-3 text-left"
          >
            <span>
              <strong className="block text-sm text-[#0B0B0F]">Unrelated · {(topic.unrelated || []).length}</strong>
              <span className="mt-0.5 block text-sm text-[#60646C]">Archived by {topic.adminName}. Closed until you open it.</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#0B0B0F]">{showUnrelated ? 'Close' : 'Open'}</span>
          </button>
          {showUnrelated && (
            <div className="mt-4 space-y-4">
              {(topic.unrelated || []).map((source) => (
                <SourceCard key={source.id} source={source} listen={listen} open={openSources.includes(source.id)} onToggle={() => toggleSource(source.id)} canNote={topic.isAdmin || source.postedByMe} busy={busy} onNote={(text) => onUpdate('addendum', { sourceId: source.id, text })}>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#9a3412]">Archived · unrelated</p>
                  <SourceTools source={source} busy={busy} isAdmin={topic.isAdmin} archived onUpdate={onUpdate} />
                </SourceCard>
              ))}
            </div>
          )}
        </section>
      )}

      {(dock ? (panel: ReactNode) => createPortal(panel, dock) : (panel: ReactNode) => panel)(
      <section id="add" className={dock ? 'mt-4 flex flex-col rounded-[18px] border border-[#E6E8EC] bg-white p-3 shadow-sm' : 'mt-8 rounded-[18px] border border-[#E6E8EC] bg-white p-4 md:p-5'}>
        <h3 className={dock ? 'shrink-0 text-base font-semibold text-[#0B0B0F]' : 'text-2xl font-semibold tracking-tight text-[#0B0B0F]'}>Add to the record</h3>
        <div className={`mt-3 grid shrink-0 grid-cols-2 gap-2 ${dock ? '' : 'sm:grid-cols-4'}`}>
          {tiles.map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[14px] border px-2 py-2 text-center text-sm font-semibold leading-tight ${mode === id ? 'border-[#0B0B0F] bg-white' : 'border-[#E6E8EC] bg-[#FAFAF8]'}`}
            >
              {label}
              <small className="block w-full text-xs font-medium leading-tight text-[#60646C]">{hint}</small>
            </button>
          ))}
        </div>
        <div className={`mt-3 flex shrink-0 flex-col overflow-hidden ${dock ? 'h-[16rem]' : 'h-[20rem]'}`}>
        {mode === 'ask' && (
        <form
          className="flex h-full min-h-0 flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!followUp.trim()) return
            const saved = await onUpdate('ask', { text: followUp.trim() })
            if (saved) {
              setReviewTab('results')
              setShowHistory(true)
            }
          }}
        >
          <textarea
            id="topic-ask"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            placeholder="Ask for a narrower detail, such as a 1962 letter. You approve each passage before it is added."
            className="min-h-0 w-full flex-1 resize-none rounded-2xl border border-[#E6E8EC] bg-[#FAFAF8] p-4 text-sm leading-6 outline-none focus:border-[#FF6A00]"
          />
          <button type="submit" disabled={busy || followUp.trim().length < 3} className={`h-[52px] shrink-0 rounded-full bg-[#FF6A00] px-5 text-sm font-semibold text-white disabled:opacity-50 ${dock ? 'w-full' : 'self-end'}`}>
            {busy ? 'Looking…' : 'Search'}
          </button>
        </form>
        )}
        {mode === 'photo' && (
          <label
            className={`flex h-full min-h-0 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center ${dragging ? 'border-[#FF6A00] bg-[#FFF4EC]' : 'border-[#D0D5DD] bg-[#FAFAFB]'}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files?.[0]
              if (file) onUpload(file)
            }}
          >
            <span className="text-sm font-semibold text-[#0B0B0F]">{busy ? 'Adding…' : 'Drop a picture or video here, or browse'}</span>
            <span className="mt-1 text-xs text-[#60646C]">JPEG, PNG, WebP, MP4, or WebM. It is added to this question.</span>
            {error ? <span className="mt-2 text-xs text-red-600">{error}</span> : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onUpload(file)
              }}
            />
          </label>
        )}
        {mode === 'files' && (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <label
              className={`flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center ${dragging ? 'border-[#FF6A00] bg-[#FFF4EC]' : 'border-[#D0D5DD] bg-[#FAFAFB]'}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const files = Array.from(event.dataTransfer.files || [])
                if (files.length) onUploadPdfs(files)
              }}
            >
              <span className="text-sm font-semibold text-[#0B0B0F]">{busy ? 'Reading the PDFs…' : 'Drop PDFs here, or browse'}</span>
              <span className="mt-1 text-xs text-[#60646C]">Several files at once. Each one is read and added to this question.</span>
              {error ? <span className="mt-2 text-xs text-red-600">{error}</span> : null}
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const files = Array.from(event.target.files || [])
                  event.target.value = ''
                  if (files.length) onUploadPdfs(files)
                }}
              />
            </label>
            <input
              value={lookFor}
              onChange={(event) => setLookFor(event.target.value)}
              placeholder="What should we look for?"
              className="h-11 w-full shrink-0 rounded-full border border-[#E6E8EC] bg-white px-4 text-sm outline-none focus:border-[#FF6A00]"
            />
          </div>
        )}
        {mode === 'link' && (
          <form
            className="flex h-full min-h-0 flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (link.trim()) onUpdate('source', { url: link.trim(), lookFor: lookFor.trim() })
            }}
          >
            <p className="shrink-0 text-sm leading-6 text-[#60646C]">{busy ? 'Opening the page and reading it.' : 'Paste a page or a PDF. The file is read, and a passage is added with the link.'}</p>
            {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://"
              className="h-11 w-full shrink-0 rounded-full border border-[#E6E8EC] bg-white px-4 text-sm outline-none focus:border-[#FF6A00]"
            />
            <textarea
              value={lookFor}
              onChange={(event) => setLookFor(event.target.value)}
              placeholder="What should we look for? Such as a pearl harbor event"
              className="min-h-0 w-full flex-1 resize-none rounded-2xl border border-[#E6E8EC] bg-white p-3 text-sm leading-6 outline-none focus:border-[#FF6A00]"
            />
            <button type="submit" disabled={busy || !link.trim()} className="h-11 w-full shrink-0 rounded-full bg-[#0B0B0F] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Reading…' : 'Add page'}
            </button>
          </form>
        )}
        {mode === 'video' && (
          <div className="h-full min-h-0">
            <VideoAdd
              busy={busy}
              onSave={(payload) => onUpdate('video', payload)}
            />
          </div>
        )}
        {mode === 'write' && (
          <form
            className="flex h-full min-h-0 flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (written.trim()) onUpdate('text', { text: written.trim() })
            }}
          >
            <textarea
              value={written}
              onChange={(event) => setWritten(event.target.value)}
              placeholder="Write something the question should remember. This is saved as part of it."
              className="min-h-0 w-full flex-1 resize-none rounded-2xl border border-[#E6E8EC] bg-white p-4 text-sm leading-7 outline-none focus:border-[#FF6A00]"
            />
            <button type="submit" disabled={busy || !written.trim()} className="h-11 w-full shrink-0 rounded-full bg-[#0B0B0F] px-4 text-sm font-semibold text-white disabled:opacity-50">
              Add this
            </button>
          </form>
        )}
        </div>
        {(latest || earlierMessages.length > 0 || loose.length > 0) && (
          <div className="mt-3 flex shrink-0 gap-3">
            {latest && (
              <button type="button" onClick={() => { setReviewTab('results'); setShowHistory(true) }} className="text-left text-sm font-semibold text-[#60646C]">
                {latestWaiting.length > 0 ? `Review ${latestWaiting.length}` : 'Last result'}
              </button>
            )}
            {(earlierMessages.length > 0 || loose.length > 0) && (
              <button type="button" onClick={() => { setReviewTab('earlier'); setShowHistory(true) }} className="text-left text-sm font-semibold text-[#60646C]">
                Earlier asks
              </button>
            )}
          </div>
        )}
        {showHistory && createPortal(
          <div
            className="fixed bottom-0 right-0 top-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            style={{ left: '5rem' }}
            onClick={() => setShowHistory(false)}
            onKeyDown={(event) => { if (event.key === 'Escape') setShowHistory(false) }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Review passages"
              className="flex h-[90%] w-[90%] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E6E8EC] px-6 py-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setReviewTab('results')} className={`rounded-full px-3.5 py-2 text-sm font-semibold ${reviewTab === 'results' ? 'bg-[#0B0B0F] text-white' : 'border border-[#E6E8EC]'}`}>Results</button>
                  {(earlierMessages.length > 0 || loose.length > 0) && (
                    <button type="button" onClick={() => setReviewTab('earlier')} className={`rounded-full px-3.5 py-2 text-sm font-semibold ${reviewTab === 'earlier' ? 'bg-[#0B0B0F] text-white' : 'border border-[#E6E8EC]'}`}>Earlier</button>
                  )}
                </div>
                <button type="button" onClick={() => setShowHistory(false)} className="rounded-full border border-[#E6E8EC] px-4 py-2 text-sm font-semibold">Close</button>
              </div>
              <div className={reviewTab === 'results' ? 'min-h-0 flex-1 overflow-hidden px-4 py-4' : 'min-h-0 flex-1 overflow-y-auto px-6 py-5'}>
                {reviewTab === 'results' && (
                  latestDocs.length > 0 ? (
                    <div ref={reviewRow} className="flex h-full snap-x snap-mandatory gap-14 overflow-x-auto scroll-pl-8 pl-8">
                      {latestDocs.map((source, index) => (
                        <div key={source.id} data-doc className="relative h-full w-[calc(100%-13rem)] shrink-0 snap-start">
                          <DocumentReview
                            source={source}
                            kept={topic.sources.some((item) => item.id === source.id)}
                            busy={busy}
                            listen={listen}
                            onSaveAll={() => { void onUpdate('approve', { sourceId: source.id }) }}
                            onKeep={(quote) => { void onUpdate('clip', { quote, url: source.url, title: source.title }) }}
                            onReject={() => { void onUpdate('deny', { sourceId: source.id }) }}
                          />
                          {index < latestDocs.length - 1 && (
                            <button
                              type="button"
                              aria-label="Next document"
                              onClick={() => {
                                const row = reviewRow.current
                                const card = row?.querySelectorAll<HTMLElement>('[data-doc]')[index + 1]
                                if (!row || !card) return
                                const left = card.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 32
                                row.scrollTo({ left, behavior: 'smooth' })
                              }}
                              className="absolute left-[calc(100%+1.75rem)] top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0B0B0F] text-white shadow-md"
                            >
                              <ArrowRight className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="px-2 text-sm text-[#60646C]">Nothing left to review from this search.</p>
                )}
                <div className="mx-auto flex max-w-3xl flex-col gap-5">
                  {reviewTab === 'earlier' && loose.map((source) => (
                    <SourceCard key={source.id} source={source} listen={listen}>
                      <div className="mt-3 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => onUpdate('approve', { sourceId: source.id })} className="rounded-full bg-[#0B0B0F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
                        <button type="button" disabled={busy} onClick={() => onUpdate('deny', { sourceId: source.id })} className="rounded-full border border-[#E6E8EC] px-4 py-2 text-sm font-semibold disabled:opacity-50">Skip</button>
                      </div>
                    </SourceCard>
                  ))}
                  {reviewTab === 'earlier' && earlierMessages.map((message) => (
                    <div key={message.id} className={message.role === 'user' ? 'max-w-[80%] self-end rounded-2xl bg-[#F4F5F7] px-4 py-3' : ''}>
                      <p className="text-xs font-semibold text-[#60646C]">{message.role === 'user' ? message.name : 'Search'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#0B0B0F]">{message.text}</p>
                      {message.sourceIds.length > 0 && (
                        <div className="mt-3 space-y-4">
                          {message.sourceIds.map((sourceId) => {
                            const source = findSource(sourceId)
                            if (!source) return <p key={sourceId} className="text-xs text-[#60646C]">Skipped</p>
                            const kept = topic.sources.some((item) => item.id === sourceId)
                            if (kept) return <p key={sourceId} className="text-xs text-[#60646C]">Added · {source.title}</p>
                            return (
                              <SourceCard key={sourceId} source={source} listen={listen}>
                                <div className="mt-3 flex gap-2">
                                  <button type="button" disabled={busy} onClick={() => onUpdate('approve', { sourceId })} className="rounded-full bg-[#0B0B0F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
                                  <button type="button" disabled={busy} onClick={() => onUpdate('deny', { sourceId })} className="rounded-full border border-[#E6E8EC] px-4 py-2 text-sm font-semibold disabled:opacity-50">Skip</button>
                                </div>
                              </SourceCard>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </section>
      )}

      <section id="discussion" className="mt-8 border-t border-[#E6E8EC] pt-7">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-[#0B0B0F]">Discussion{topic.replies.length > 0 ? ` · ${topic.replies.length}` : ''}</h3>
          <p className="mt-1 text-sm text-[#60646C]">Opinion and argument. A comment does not become a source. Same tools as the feed: emoji, GIF, photo, video, voice, and reply.</p>
        </div>
        <div className="mt-4 space-y-3">
          {topic.replies.filter((reply) => {
            const parentId = replyParent(reply)
            return !parentId || !topic.replies.some((item) => item.id === parentId)
          }).map((reply) => (
            <TopicThread
              key={reply.id}
              reply={reply}
              replies={topic.replies}
              depth={0}
              onReply={(target) => {
                setReplyTo(target)
                setFocusToken((token) => token + 1)
              }}
            />
          ))}
          {topic.replies.length === 0 && <p className="text-sm text-[#60646C]">No comments yet. Be the first.</p>}
        </div>
        {replyTo && (
          <div className="mt-3 flex items-center justify-between bg-orange-50 px-4 py-2 text-xs text-orange-800">
            <span>Replying to {replyTo.name}</span>
            <button type="button" className="font-medium" onClick={() => setReplyTo(null)}>Cancel</button>
          </div>
        )}
        <RichComposer
          variant="reply"
          placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Write a comment...'}
          submitLabel="Reply"
          focusToken={focusToken}
          disabled={busy}
          onSend={async ({ text, attachment }) => {
            let media: { kind: 'image' | 'video' | 'audio' | 'gif'; url: string } | undefined
            if (attachment?.file) {
              const safeName = (attachment.file.name || 'attachment').replace(/[^\w.-]+/g, '_')
              const url = await uploadFileToFirebase(attachment.file, `topic-comments/${topic.id}/${Date.now()}_${safeName}`)
              media = { kind: attachment.kind, url }
            } else if (attachment?.url) {
              media = { kind: attachment.kind, url: attachment.url }
            }
            const content = encodeComment(text, media, undefined, replyTo?.id)
            if (!content) throw new Error('Write a comment or add a photo, video, GIF, or voice message.')
            const posted = await onUpdate('reply', { text: content })
            if (!posted) throw new Error('Could not post that comment.')
            setReplyTo(null)
          }}
        />
      </section>
    </article>
  )
}

function titleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return 'Question'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function AskView({ patch, initialTopicId = '' }: AskViewProps) {
  const [question, setQuestion] = useState('')
  const [topics, setTopics] = useState<TopicCard[]>([])
  const [openId, setOpenId] = useState<string | null>(initialTopicId || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [lookFor, setLookFor] = useState('')
  const [written, setWritten] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [mode, setMode] = useState<'ask' | 'photo' | 'link' | 'video' | 'write' | 'files'>('ask')
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState('')
  const [addDock, setAddDock] = useState<HTMLElement | null>(null)

  const open = topics.find((topic) => topic.id === openId || topic.slug === openId)
    || topics.find((topic) => {
      if (!openId || openId.length < 40) return false
      const slug = topic.slug || ''
      return slug.startsWith(openId) || openId.startsWith(slug)
    })
    || null
  const waiting = Boolean(openId) && !open
  const filled = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patches/${patch.handle}/topics`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.topics)) return
        setTopics(data.topics)
        if (!data.topics.some((topic: TopicCard) => !cardThumb(topic))) return
        fetch(`/api/patches/${patch.handle}/topics?photos=1`)
          .then((response) => response.json())
          .then((filled) => {
            if (!cancelled && Array.isArray(filled?.topics)) setTopics(filled.topics)
          })
          .catch(() => undefined)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [patch.handle])

  useEffect(() => {
    const target = open
    if (!target) return
    const needsRepair = target.sources.some((source) => /news\.google\.com/i.test(source.url) || /^[a-z]/.test(source.quote.trim()) || /^[A-Z] [a-z]{3,}/.test(source.quote.trim()))
    if (filled.current.has(target.id) || (target.sources.length >= 10 && target.image && !needsRepair)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      filled.current.add(target.id)
      const focus = `?fill=1&topic=${encodeURIComponent(target.slug || target.id)}`
      fetch(`/api/patches/${patch.handle}/topics${focus}`)
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data?.topics)) setTopics(data.topics)
        })
        .catch(() => undefined)
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, patch.handle])

  useLayoutEffect(() => {
    if (!openId) return
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    let userMoved = false
    const stop = () => { userMoved = true }
    const toTop = () => {
      if (userMoved) return
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      let node = document.getElementById('question-top')?.parentElement || null
      while (node) {
        if (node.scrollTop) node.scrollTop = 0
        node = node.parentElement
      }
    }
    toTop()
    let frames = 0
    let raf = 0
    const tick = () => {
      if (userMoved || frames > 12) return
      toTop()
      frames += 1
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    const timers = [80, 200, 450].map((delay) => window.setTimeout(toTop, delay))
    const arm = window.setTimeout(() => {
      window.addEventListener('wheel', stop, { passive: true, once: true })
      window.addEventListener('touchmove', stop, { passive: true, once: true })
      window.addEventListener('keydown', stop, { once: true })
    }, 60)
    return () => {
      userMoved = true
      window.cancelAnimationFrame(raf)
      window.clearTimeout(arm)
      timers.forEach((timer) => window.clearTimeout(timer))
      window.history.scrollRestoration = previous
    }
  }, [openId])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const sync = () => setAddDock(media.matches ? document.getElementById('topic-add-dock') : null)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [openId])

  useEffect(() => {
    if (open?.slug) {
      const next = `/patch/${patch.handle}/${open.slug}`
      document.title = `${open.question} · ${patch.name}`
      if (`${window.location.pathname}${window.location.search}` !== next) {
        window.history.replaceState(null, '', next)
      }
      return
    }
    if (!openId) {
      const next = `/patch/${patch.handle}`
      if (window.location.pathname !== next) window.history.replaceState(null, '', next)
    }
  }, [open?.slug, open?.question, openId, patch.handle, patch.name])

  const replaceTopic = (topic: TopicCard) => {
    setTopics((current) => [topic, ...current.filter((item) => item.id !== topic.id)])
    setOpenId(topic.id)
  }

  const ask = async (event: FormEvent) => {
    event.preventDefault()
    const next = question.trim()
    if (next.length < 8 || busy) return
    setBusy(true)
    setError('')
    const response = await fetch(`/api/patches/${patch.handle}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: next })
    })
    const data = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok || !data?.topic) {
      setError(data?.error || 'Could not open that question.')
      return
    }
    setQuestion('')
    replaceTopic(data.topic)
  }

  const update = async (action: 'reply' | 'source' | 'image' | 'search' | 'approve' | 'deny' | 'ask' | 'text' | 'video' | 'clip' | 'vote' | 'archive' | 'restore' | 'addendum', payload: Record<string, string>) => {
    if (!open || busy) return false
    setBusy(true)
    setError('')
    const response = await fetch(`/api/patches/${patch.handle}/topics/${open.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    })
    const data = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok || !data?.topic) {
      setError(data?.error || 'Could not save that.')
      return false
    }
    if (action === 'source') {
      setLink('')
      setLookFor('')
    }
    if (action === 'ask') setFollowUp('')
    if (action === 'text') setWritten('')
    if (action === 'video') setNotice('Added. The video plays on this question, with the transcript under it.')
    if (action === 'deny') setNotice('Rejected. It stays off this question.')
    if (action === 'archive') setNotice('Set aside. It is in Unrelated.')
    if (action === 'restore') setNotice('Put back on the record.')
    if (action === 'source' || action === 'image' || action === 'text' || action === 'clip' || action === 'approve') setNotice('Added. It is on this question.')
    if (action === 'addendum') setNotice('Note added. The source is unchanged.')
    replaceTopic(data.topic)
    return true
  }

  const uploadImage = async (file: File) => {
    if (!open || busy) return
    setBusy(true)
    setError('')
    const body = new FormData()
    body.set('file', file)
    const response = await fetch(`/api/patches/${patch.handle}/topics/${open.id}`, { method: 'POST', body })
    const data = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok || !data?.topic) {
      setError(data?.error || 'Could not save that file.')
      return
    }
    setNotice('Added. It is on this question.')
    replaceTopic(data.topic)
  }

  const uploadPdfs = async (files: File[]) => {
    if (!open || busy) return
    const pdfs = files.filter((file) => file.type === 'application/pdf' || file.type === 'application/x-pdf' || file.name.toLowerCase().endsWith('.pdf'))
    const batch = pdfs.slice(0, 12)
    const skipped = files.length - pdfs.length
    if (!pdfs.length) {
      setError('Drop PDF files.')
      return
    }
    setBusy(true)
    setError('')
    let added = 0
    let failed = ''
    for (let index = 0; index < batch.length; index += 1) {
      setNotice(`Adding ${index + 1} of ${batch.length}…`)
      const body = new FormData()
      body.set('file', batch[index])
      if (lookFor.trim()) body.set('lookFor', lookFor.trim())
      const response = await fetch(`/api/patches/${patch.handle}/topics/${open.id}`, { method: 'POST', body })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.topic) {
        failed = data?.error || 'Could not add that PDF.'
        break
      }
      replaceTopic(data.topic)
      added += 1
    }
    setBusy(false)
    const left = pdfs.length - batch.length
    const skippedNote = [
      skipped > 0 ? `${skipped} ${skipped === 1 ? 'file was' : 'files were'} not a PDF.` : '',
      left > 0 ? 'Drop the rest next.' : ''
    ].filter(Boolean).join(' ')
    if (failed) setError(added ? `${added} added. ${failed}` : failed)
    else {
      setLookFor('')
      setNotice(`${added === 1 ? 'Added. It is on this question.' : `Added ${added} PDFs. They are on this question.`}${skippedNote ? ` ${skippedNote}` : ''}`)
    }
  }

  return (
    <div className="px-6 py-10 md:px-8 [overflow-anchor:none]">
      <div className="mx-auto max-w-5xl">
        {!open && !waiting && (
          <>
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-[#0B0B0F] md:text-4xl">
                What do you want to learn about?
              </h2>
              <p className="mt-3 text-sm text-[#60646C]">
                A question becomes its own card. Search fills it with quoted sources, and the group can add to it.
              </p>
            </div>
            <form onSubmit={ask} className="mt-8">
              <label className="sr-only" htmlFor="learn-question">What do you want to learn about?</label>
              <div className="flex items-center gap-2 rounded-full border border-[#E6E8EC] bg-white px-4 py-2 shadow-sm focus-within:border-[#FF6A00]">
                <Search className="h-5 w-5 shrink-0 text-[#60646C]" />
                <input
                  id="learn-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a specific question"
                  className="h-12 w-full bg-transparent text-base text-[#0B0B0F] outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || question.trim().length < 8}
                  className="h-10 shrink-0 rounded-full bg-[#FF6A00] px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Gathering…' : 'Ask'}
                </button>
              </div>
            </form>
          </>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {waiting && (
          <article className="mx-auto mt-2 max-w-5xl">
            <div className="flex items-center justify-between py-3">
              <button type="button" onClick={() => setOpenId(null)} className="inline-flex items-center gap-2 text-sm font-medium text-[#60646C]">
                <ArrowLeft className="h-4 w-4" />
                Questions
              </button>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0B0B0F] md:text-3xl">{titleFromSlug(openId || '')}</h2>
          </article>
        )}

        {open ? (
          <TopicRoom
            topic={open}
            busy={busy}
            mode={mode}
            setMode={setMode}
            followUp={followUp}
            setFollowUp={setFollowUp}
            link={link}
            setLink={setLink}
            lookFor={lookFor}
            setLookFor={setLookFor}
            written={written}
            setWritten={setWritten}
            dragging={dragging}
            setDragging={setDragging}
            onBack={() => { setOpenId(null); setError(''); setNotice('') }}
            patchHandle={patch.handle}
            notice={notice}
            error={error}
            dock={addDock}
            onUpdate={update}
            onUpload={uploadImage}
            onUploadPdfs={uploadPdfs}
            patchName={patch.name}
          />
        ) : waiting ? null : topics.length === 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="aspect-[2/3] animate-pulse rounded-md bg-[#F5F5F4]" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {topics.map((topic) => (
              <a
                key={topic.id}
                href={`/patch/${patch.handle}/${topic.slug || topic.id}`}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                  event.preventDefault()
                  setOpenId(topic.slug || topic.id)
                }}
                className="group relative aspect-[2/3] overflow-hidden rounded-md bg-[#141414] text-left shadow-md transition duration-200 hover:z-10 hover:scale-[1.04] hover:shadow-xl"
              >
                <CardPhoto src={cardCandidates(topic)} className="absolute inset-0 transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{topic.question}</h3>
                  <p className="mt-2 truncate text-[11px] text-white/80">
                    {topic.adminName} · {shortDate(topic.createdAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-3 text-[11px] text-white/80">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {topic.replies.length}
                    </span>
                    <span>{topic.sources.length} sources</span>
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
