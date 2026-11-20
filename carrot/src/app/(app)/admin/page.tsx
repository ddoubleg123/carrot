import Link from 'next/link'
import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import { ADMIN_LINKS } from '@/lib/admin'
import { curatorAllowed } from '@/lib/curator/access'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await curatorAllowed())) notFound()
  return (
    <div className="flex min-h-screen bg-[#F6F3EE]">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E6E8EC] bg-[#FAFAF8]">
        <MinimalNav />
      </aside>
      <main className="mx-auto w-full max-w-[680px] px-5 pt-10 pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Admin</p>
        <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-[#0B0B0F]">Your tools</h1>
        <ul className="mt-6 space-y-3">
          {ADMIN_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded-[18px] border border-[#E6E8EC] bg-white px-4 py-4 hover:border-[#FF6A00]">
                <span className="block text-[15px] font-semibold text-[#0B0B0F]">{item.label}</span>
                <span className="mt-1 block text-sm text-[#60646C]">{item.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
