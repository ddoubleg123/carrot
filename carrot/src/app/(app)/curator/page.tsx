import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import { curatorAllowed } from '@/lib/curator/access'
import { loadFloor } from '@/lib/curator/floor'
import { CuratorBoard } from './CuratorBoard'

export const dynamic = 'force-dynamic'

export default async function CuratorPage() {
  if (!(await curatorAllowed())) notFound()
  const floor = await loadFloor()
  return (
    <div className="flex min-h-screen bg-[#F6F3EE]">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E7E0D6] bg-[#F6F3EE]">
        <MinimalNav />
      </aside>
      <div className="min-w-0 flex-1">
        <CuratorBoard initial={floor} />
      </div>
    </div>
  )
}
