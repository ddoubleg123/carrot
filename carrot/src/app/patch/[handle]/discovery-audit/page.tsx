import DiscoveryAuditClient from './DiscoveryAuditClient'

export default async function DiscoveryAuditPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return <DiscoveryAuditClient handle={handle} />
}









