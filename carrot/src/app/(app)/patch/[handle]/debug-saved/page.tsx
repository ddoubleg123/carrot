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

  // Get what the API endpoint would return (what's shown on the page)
  const apiLimit = 50
  const apiContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    orderBy: [
      { relevanceScore: 'desc' },
      { createdAt: 'desc' }
    ],
    take: apiLimit,
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      domain: true,
      relevanceScore: true,
      createdAt: true
    }
  })
  const apiContentIds = new Set(apiContent.map(c => c.id))

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
        relevanceScore: true,
        qualityScore: true,
        summary: true,
        whyItMatters: true,
        createdAt: true,
        textContent: true,
        hero: true,
        heroRecord: {
          select: {
            id: true,
            status: true,
            imageUrl: true,
            sourceUrl: true
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
        imageUrl: true,
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

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Total Sources (DB)</div>
          <div className="text-3xl font-bold">{sourceCount}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Shown on Page</div>
          <div className="text-3xl font-bold text-blue-600">{apiContent.length}</div>
          <div className="text-xs text-gray-500 mt-1">(API limit: {apiLimit})</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-600">Not Shown</div>
          <div className="text-3xl font-bold text-orange-600">{sourceCount - apiContent.length}</div>
          <div className="text-xs text-gray-500 mt-1">(Below relevance threshold or limit)</div>
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
                <th className="px-4 py-2 text-left">On Page?</th>
                <th className="px-4 py-2 text-left">Domain</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Relevance</th>
                <th className="px-4 py-2 text-left">Quality</th>
                <th className="px-4 py-2 text-left">Has Hero</th>
                <th className="px-4 py-2 text-left">Hero URL</th>
                <th className="px-4 py-2 text-left">Text Length</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const isOnPage = apiContentIds.has(s.id)
                return (
                  <tr key={s.id} className={`border-t ${isOnPage ? 'bg-green-50' : 'bg-orange-50'}`}>
                    <td className="px-4 py-2">
                      {isOnPage ? (
                        <span className="text-green-600 font-semibold">✓ YES</span>
                      ) : (
                        <span className="text-orange-600 font-semibold">✗ NO</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{s.domain || 'unknown'}</td>
                    <td className="px-4 py-2 max-w-md truncate" title={s.title}>
                      {s.title}
                    </td>
                    <td className="px-4 py-2">
                      <span className={s.relevanceScore && s.relevanceScore > 0.5 ? 'text-green-600' : 'text-gray-500'}>
                        {s.relevanceScore?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={s.qualityScore && s.qualityScore >= 70 ? 'text-green-600' : s.qualityScore && s.qualityScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                        {s.qualityScore?.toFixed(0) || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {s.heroRecord ? (
                        <span className={s.heroRecord.status === 'READY' ? 'text-green-600' : 'text-red-600'}>
                          ✓ {s.heroRecord.status}
                        </span>
                      ) : (s.hero && typeof s.hero === 'object' && (s.hero as any)?.url) ? (
                        <span className="text-yellow-600">✓ JSON</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs max-w-xs truncate" title={s.heroRecord?.imageUrl || (s.hero && typeof s.hero === 'object' ? (s.hero as any)?.url : '') || ''}>
                      {s.heroRecord?.imageUrl || (s.hero && typeof s.hero === 'object' ? (s.hero as any)?.url : '') || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={s.textContent && s.textContent.length > 0 ? 'text-green-600' : 'text-red-600'}>
                        {s.textContent?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {s.createdAt.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
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
                <th className="px-4 py-2 text-left">Image URL</th>
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
                  <td className="px-4 py-2 text-xs max-w-xs truncate" title={h.imageUrl || ''}>
                    {h.imageUrl || '—'}
                  </td>
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

