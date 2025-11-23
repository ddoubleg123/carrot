import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

export default async function DebugSavedPage({
  params
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    notFound()
  }

  const [sourceCount, heroCount, sources, heroes] = await Promise.all([
    prisma.discoveredContent.count({ where: { patchId: patch.id } }),
    prisma.hero.count({ where: { content: { patchId: patch.id } } }),
    prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        title: true,
        canonicalUrl: true,
        domain: true,
        createdAt: true,
        textContent: true,
        heroRecord: {
          select: {
            id: true,
            status: true
          }
        }
      }
    }),
    prisma.hero.findMany({
      where: { content: { patchId: patch.id } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
        content: {
          select: {
            domain: true
          }
        }
      }
    })
  ])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Debug Saved — {patch.title}</h1>
        <p className="text-sm text-gray-600">Patch: {patch.handle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Sources (DiscoveredContent)</div>
          <div className="text-3xl font-bold">{sourceCount}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Heroes</div>
          <div className="text-3xl font-bold">{heroCount}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-medium mb-4">Recent Sources (Last 25)</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Domain</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Has Hero</th>
                <th className="px-4 py-2 text-left">Text Length</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.domain || 'unknown'}</td>
                  <td className="px-4 py-2 max-w-md truncate" title={s.title}>
                    {s.title}
                  </td>
                  <td className="px-4 py-2">
                    {s.heroRecord ? (
                      <span className="text-green-600">✓ {s.heroRecord.status}</span>
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.textContent?.length || 0}</td>
                  <td className="px-4 py-2 text-xs">
                    {s.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-4">Recent Heroes (Last 25)</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Domain</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {heroes.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-4 py-2">
                    <span
                      className={
                        h.status === 'READY'
                          ? 'text-green-600'
                          : h.status === 'ERROR'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                      }
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-md truncate" title={h.title}>
                    {h.title}
                  </td>
                  <td className="px-4 py-2">{h.content?.domain || 'unknown'}</td>
                  <td className="px-4 py-2 text-xs">
                    {h.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

