import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import ClientSessionProvider from '@/app/(app)/dashboard/components/ClientSessionProvider'
import { curatorAllowed } from '@/lib/curator/access'

export const dynamic = 'force-dynamic'

export default async function ChannelsLayout({ children }: { children: React.ReactNode }) {
  if (!(await curatorAllowed())) notFound()
  return (
    <ClientSessionProvider>
      <div className="flex min-h-screen bg-[#F6F3EE]">
        <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E6E8EC] bg-[#FAFAF8]">
          <MinimalNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ClientSessionProvider>
  )
}
