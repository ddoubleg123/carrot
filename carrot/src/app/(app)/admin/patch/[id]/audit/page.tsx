import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

/**
 * Admin audit page for inspecting saved discovery items
 * /admin/patch/[id]/audit
 */
export default async function AdminAuditPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const patch = await prisma.patch.findUnique({
    where: { id },
    select: {
      id: true,
      handle: true,
      title: true
    }
  })
  
  if (!patch) {
    notFound()
  }
  
  // Get saved items with hero linkage
  const savedItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      sourceUrl: true,
      domain: true,
      textContent: true,
      createdAt: true,
      heroRecord: {
        select: {
          id: true,
          status: true,
          imageUrl: true,
          errorCode: true
        }
      },
      metadata: true
    }
  })
  
  // Extract render_ok and extract_ok from metadata
  const itemsWithStatus = savedItems.map(item => {
    const metadata = item.metadata as any
    const renderOk = metadata?.renderUsed === true || metadata?.render_ok === true
    const extractOk = (item.textContent?.length || 0) > 0
    
    return {
      ...item,
      renderOk,
      extractOk,
      textLength: item.textContent?.length || 0,
      extractedAt: item.createdAt
    }
  })
  
  const totalCount = await prisma.discoveredContent.count({
    where: { patchId: patch.id }
  })
  
  const heroCount = await prisma.hero.count({
    where: {
      content: { patchId: patch.id }
    }
  })
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Discovery Audit — {patch.title}</h1>
        <p className="text-gray-600">Patch ID: {patch.id}</p>
        <p className="text-gray-600">Handle: {patch.handle}</p>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Total Sources</div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Heroes</div>
          <div className="text-2xl font-bold">{heroCount}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Extract OK</div>
          <div className="text-2xl font-bold">
            {itemsWithStatus.filter(i => i.extractOk).length}
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Render OK</div>
          <div className="text-2xl font-bold">
            {itemsWithStatus.filter(i => i.renderOk).length}
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Extracted At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Render OK
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Extract OK
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Text Length
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hero
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {itemsWithStatus.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={item.title}>
                    {item.title || '(no title)'}
                  </div>
                  <div className="text-xs text-gray-500 truncate max-w-xs">
                    <a href={item.canonicalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {item.canonicalUrl}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.domain || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.extractedAt.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.renderOk ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ✓
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      —
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.extractOk ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ✓
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      ✗
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.textLength.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.heroRecord ? (
                    <Link 
                      href={`/patch/${patch.handle}#hero-${item.heroRecord.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.heroRecord.status === 'READY' ? '✓ READY' : item.heroRecord.status}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-sm text-gray-600">
        Showing {itemsWithStatus.length} of {totalCount} saved items
      </div>
    </div>
  )
}

