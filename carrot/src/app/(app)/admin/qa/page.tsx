import Link from 'next/link'
import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import { ADMIN_EMAILS } from '@/lib/admin'
import { curatorAllowed } from '@/lib/curator/access'
import { recentQa } from '@/lib/curator/qaLog'

export const dynamic = 'force-dynamic'

export default async function QaAdminPage() {
  if (!(await curatorAllowed())) notFound()
  const rows = await recentQa(7).catch(() => [])
  const counts = {
    fixed: rows.filter((row) => row.kind === 'fix').length,
    held: rows.filter((row) => row.kind === 'hold').length,
    corrected: rows.filter((row) => row.kind === 'correction').length,
    refused: rows.filter((row) => (row.reason || '').includes('not cleared')).length
  }
  const holds = rows.filter((row) => row.kind === 'hold')
  return (
    <div className="flex min-h-screen bg-[#F6F3EE]">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E6E8EC] bg-[#FAFAF8]">
        <MinimalNav />
      </aside>
      <main className="mx-auto w-full max-w-[720px] px-5 pt-10 pb-16 text-[#1C1917]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Admin</p>
        <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight">QA this week</h1>
        <p className="mt-2 text-sm text-[#57534E]">
          Duty reviewer: {ADMIN_EMAILS.join(', ')}. A hold stays unpublished. If nobody decides within 2 hours, it stays held.
        </p>
        <p className="mt-3 text-sm"><Link href="/admin" className="text-[#FF6A00] underline">All tools</Link></p>
        <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <li className="rounded-2xl bg-white px-4 py-3">Rewrites: {counts.fixed}</li>
          <li className="rounded-2xl bg-white px-4 py-3">Holds: {counts.held}</li>
          <li className="rounded-2xl bg-white px-4 py-3">Corrections: {counts.corrected}</li>
          <li className="rounded-2xl bg-white px-4 py-3">Cards refused: {counts.refused}</li>
        </ul>
        <h2 className="mt-8 text-lg font-semibold">Holds</h2>
        {holds.length === 0 ? <p className="mt-2 text-sm text-[#57534E]">None this week.</p> : (
          <ul className="mt-3 space-y-3">
            {holds.map((row) => (
              <li key={row.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                <p>{row.reason}</p>
                {row.sourceUrl ? <p className="mt-1 break-all text-[#57534E]">{row.sourceUrl}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
