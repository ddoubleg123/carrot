import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import PatchBody, { patchMetadata } from '../PatchBody'

const RESERVED = new Set(['content', 'debug-saved', 'debug-heroes'])

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string; topic: string }>
}): Promise<Metadata> {
  const { handle: raw, topic } = await params
  const handle = raw === 'wire-model-policy' ? 'ai' : raw
  if (RESERVED.has(topic)) return { title: 'Carrot Patch' }
  return patchMetadata(handle, topic)
}

export default async function TopicPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string; topic: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { handle: raw, topic } = await params
  const search = await searchParams
  const handle = raw === 'wire-model-policy' ? 'ai' : raw
  if (raw !== handle) redirect(`/patch/${handle}/${topic}`)
  if (RESERVED.has(topic)) redirect(`/patch/${handle}`)
  return <PatchBody handle={handle} topicKey={topic} search={search} />
}
