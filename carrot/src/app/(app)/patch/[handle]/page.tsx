import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import PatchBody, { patchMetadata } from './PatchBody'

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const { handle: raw } = await params
  const handle = raw === 'wire-model-policy' ? 'ai' : raw
  const search = await searchParams
  const key = typeof search.topic === 'string' ? search.topic : ''
  return patchMetadata(handle, key)
}

export default async function PatchPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { handle: raw } = await params
  const search = await searchParams
  const handle = raw === 'wire-model-policy' ? 'ai' : raw
  const key = typeof search.topic === 'string' ? search.topic : ''
  if (raw !== handle || key) {
    const params = new URLSearchParams()
    if (!key) {
      for (const [name, value] of Object.entries(search)) {
        if (typeof value === 'string') params.set(name, value)
      }
    }
    const query = params.toString()
    redirect(`/patch/${handle}${key ? `/${key}` : ''}${query ? `?${query}` : ''}`)
  }
  return <PatchBody handle={handle} search={search} />
}
