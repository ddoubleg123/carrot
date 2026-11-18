'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import CommitmentCard from '../../dashboard/components/CommitmentCard'
import PostModalController from '../../../../components/post-modal/PostModalController'

type PersonPost = {
  id: string
  content: string
  createdAt: string
  imageUrls?: string[] | string | null
  gifUrl?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  audioUrl?: string | null
  likes?: number
  comments?: number
  reposts?: number
  views?: number
  gradientFromColor?: string | null
  gradientToColor?: string | null
  gradientViaColor?: string | null
  gradientDirection?: string | null
  User?: {
    id?: string
    name?: string | null
    username?: string | null
    profilePhoto?: string | null
    image?: string | null
  }
}

type Person = {
  id: string
  name: string | null
  username: string | null
  avatar: string | null
  banner: string | null
  bio: string
  disclosure: string
  followerCount: number
  following: boolean
  isSelf: boolean
  posts: PersonPost[]
}

function imagesOf(post: PersonPost): string[] {
  if (Array.isArray(post.imageUrls)) return post.imageUrls.filter(Boolean)
  if (typeof post.imageUrls === 'string') {
    try {
      const parsed = JSON.parse(post.imageUrls)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {}
  }
  return post.thumbnailUrl ? [post.thumbnailUrl] : []
}

export default function PersonProfile({ username }: { username: string }) {
  const { status } = useSession()
  const [person, setPerson] = useState<Person | null>(null)
  const [posts, setPosts] = useState<PersonPost[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stopped = false
    const handle = encodeURIComponent(username)
    fetch(`/api/people/${handle}?part=card`, { cache: 'no-store' }).then(async (res) => {
      if (stopped) return
      if (!res.ok) {
        setMissing(true)
        return
      }
      const card = await res.json()
      setPerson({ ...card, posts: [] })
    }).catch(() => { if (!stopped) setMissing(true) })
    fetch(`/api/people/${handle}?part=posts`, { cache: 'no-store' }).then(async (res) => {
      if (stopped || !res.ok) return
      const body = await res.json()
      setPosts(Array.isArray(body.posts) ? body.posts : [])
    }).catch(() => { if (!stopped) setPosts([]) })
    return () => { stopped = true }
  }, [username])

  const follow = async () => {
    if (!person || person.isSelf) return
    if (status !== 'authenticated') {
      window.location.href = '/login'
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(username)}`, { method: 'POST' })
      if (!res.ok) return
      const body = await res.json()
      setPerson((prev) => prev ? {
        ...prev,
        following: Boolean(body.following),
        followerCount: Math.max(0, prev.followerCount + (body.following ? 1 : -1))
      } : prev)
    } finally {
      setBusy(false)
    }
  }

  if (missing) {
    return <p className="px-2 py-16 text-gray-600">No account by that name.</p>
  }
  if (!person) {
    return <p className="px-2 py-16 text-gray-500">Opening profile…</p>
  }

  const display = person.name || person.username || 'Member'

  return (
    <div>
      <div className="relative overflow-hidden rounded-b-3xl">
        <button
          type="button"
          onClick={() => {
            if (document.referrer.startsWith(window.location.origin)) window.history.back()
            else window.location.assign('/home')
          }}
          className="absolute left-4 top-4 z-10 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-gray-900 shadow"
        >
          Back
        </button>
        {person.banner ? (
          <img src={person.banner} alt="" className="h-44 w-full object-cover" />
        ) : (
          <div className="h-44 w-full bg-[#1C1917]" />
        )}
      </div>
      <div className="px-2">
        <div className="flex items-end justify-between">
          <img
            src={person.avatar || '/avatar-placeholder.svg'}
            alt=""
            className="-mt-14 h-28 w-28 rounded-3xl border-4 border-[#F6F3EE] bg-white object-cover shadow-sm"
          />
          {!person.isSelf && (
            <button
              type="button"
              onClick={follow}
              disabled={busy}
              className="mb-2 rounded-full bg-[#1C1917] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {person.following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">{display}</h1>
        {person.username && <p className="text-gray-500">@{person.username}</p>}
        {person.bio && <p className="mt-3 max-w-xl text-[15px] leading-6 text-gray-800">{person.bio}</p>}
        {person.disclosure && <p className="mt-2 max-w-xl text-sm leading-5 text-gray-500">{person.disclosure}</p>}
        <p className="mt-3 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{person.followerCount}</span> followers
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {posts === null && <p className="px-2 text-sm text-gray-500">Loading posts…</p>}
        {posts && posts.length === 0 && <p className="px-2 text-sm text-gray-500">No posts yet.</p>}
        {(posts || []).map((post) => {
          const user = post.User || {}
          return (
            <CommitmentCard
              key={post.id}
              id={post.id}
              content={post.content || ''}
              author={{
                name: user.name || display,
                username: user.username || person.username || '',
                avatar: user.profilePhoto || user.image || person.avatar,
                id: user.id || person.id
              }}
              location={{ zip: '' }}
              stats={{
                likes: post.likes || 0,
                comments: post.comments || 0,
                reposts: post.reposts || 0,
                views: post.views || 0
              }}
              timestamp={post.createdAt}
              imageUrls={imagesOf(post)}
              gifUrl={post.gifUrl}
              videoUrl={post.videoUrl}
              thumbnailUrl={post.thumbnailUrl}
              audioUrl={post.audioUrl}
              gradientFromColor={post.gradientFromColor}
              gradientToColor={post.gradientToColor}
              gradientViaColor={post.gradientViaColor}
              gradientDirection={post.gradientDirection}
            />
          )
        })}
      </div>
      <PostModalController />
    </div>
  )
}
