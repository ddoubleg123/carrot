export type MediaType = 'image' | 'video' | 'gif' | 'audio'

export type MediaAssetDTO = {
  id: string
  userId: string
  type: MediaType
  url: string
  storagePath?: string | null
  thumbUrl?: string | null
  thumbPath?: string | null
  title?: string | null
  hidden: boolean
  source?: string | null
  durationSec?: number | null
  width?: number | null
  height?: number | null
  inUseCount: number
  cfUid?: string | null
  cfStatus?: string | null
  createdAt: string
  updatedAt: string
  labels?: string[]
}

export type MediaQueryClient = {
  q?: string
  includeHidden?: boolean
  type?: MediaType | 'any'
  sort?: 'newest' | 'oldest' | 'az' | 'duration'
  limit?: number
  // Optional cache-buster/refresh nonce
  t?: number
}

export async function fetchMedia(params: MediaQueryClient, opts?: { signal?: AbortSignal }) : Promise<MediaAssetDTO[]> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.includeHidden) qs.set('includeHidden', '1')
  if (params.type && params.type !== 'any') qs.set('type', params.type)
  if (params.sort) qs.set('sort', params.sort)
  if (params.limit) qs.set('limit', String(params.limit))
  if (typeof params.t === 'number') qs.set('t', String(params.t))
  const resp = await fetch('/api/media?' + qs.toString(), { cache: 'no-cache', keepalive: false, signal: opts?.signal })
  if (!resp.ok) throw new Error('Failed to fetch media')
  return resp.json()
}

export async function patchMedia(id: string, patch: { title?: string; hidden?: boolean; labels?: string[] }) {
  const resp = await fetch('/api/media', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch }),
    keepalive: false,
    cache: 'no-cache',
  })
  if (!resp.ok) throw new Error('Failed to update media')
  return resp.json()
}

export function useServerMedia(params: MediaQueryClient) {
  const React = require('react') as typeof import('react')
  const [items, setItems] = React.useState<MediaAssetDTO[] | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)

  React.useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchMedia(params, { signal: ac.signal })
      .then((r) => { if (!ac.signal.aborted) { setItems(r); setError(null) } })
      .catch((e) => { if (!ac.signal.aborted) setError(e as Error) })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => { ac.abort() }
  }, [JSON.stringify(params)])

  return { items: items ?? [], loading, error }
}
