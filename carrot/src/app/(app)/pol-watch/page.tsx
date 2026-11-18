import MinimalNav from '@/components/MinimalNav'
import PolWatch from './PolWatch'

export default function PolWatchPage() {
  return (
    <div className="min-h-screen flex bg-[#F6F3EE]">
      <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-[#F6F3EE] border-r border-gray-200">
        <MinimalNav />
      </aside>
      <main className="flex-1 min-w-0">
        <div className="w-full max-w-6xl pb-16">
          <PolWatch />
        </div>
      </main>
    </div>
  )
}
