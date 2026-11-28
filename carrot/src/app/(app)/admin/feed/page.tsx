import Link from 'next/link'
import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import { curatorAllowed } from '@/lib/curator/access'
import FeedAdmin from './FeedAdmin'

export const dynamic = 'force-dynamic'

export default async function FeedAdminPage() {
  if (!(await curatorAllowed())) notFound()
  return (
    <div className="flex min-h-screen bg-[#F6F3EE]">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E6E8EC] bg-[#FAFAF8]">
        <MinimalNav />
      </aside>
      <main className="mx-auto w-full max-w-[720px] px-5 pt-10 pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Admin</p>
        <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-[#0B0B0F]">Feed</h1>
        <p className="mt-2 text-sm text-[#60646C]">Hours move a topic forward. The mixture rules only swap the next card. Pol Watch stays on its own page unless the last number is above zero.</p>
        <p className="mt-3 text-sm"><Link href="/admin" className="text-[#FF6A00] underline">All tools</Link></p>
        <div className="mt-6">
          <FeedAdmin />
        </div>
      </main>
    </div>
  )
}
