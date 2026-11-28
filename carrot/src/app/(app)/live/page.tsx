import MinimalNav from '../../../components/MinimalNav'
import LiveDashboard from '../../../components/live/LiveDashboard'

export const dynamic = 'force-dynamic'

export default function LivePage() {
  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-white">
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 self-start border-r border-white/10 bg-[#0B0B0F] sm:block">
        <MinimalNav />
      </aside>
      <main className="min-w-0 flex-1">
        <LiveDashboard />
      </main>
    </div>
  )
}
