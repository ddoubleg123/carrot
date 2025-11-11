export {}

const ORIGINAL_ENV = { ...process.env }

const mockAuth = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockGenerateGuideSnapshot = jest.fn()
const mockSeedFrontierFromPlan = jest.fn()

jest.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args)
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patch: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args)
    }
  }
}))

jest.mock('../discovery/planner', () => {
  const actual = jest.requireActual('../discovery/planner')
  return {
    ...actual,
    generateGuideSnapshot: (...args: any[]) => mockGenerateGuideSnapshot(...args),
    seedFrontierFromPlan: (...args: any[]) => mockSeedFrontierFromPlan(...args)
  }
})

function buildRequest(url: string) {
  return new Request(url, { method: 'POST' })
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  mockAuth.mockReset()
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockGenerateGuideSnapshot.mockReset()
  mockSeedFrontierFromPlan.mockReset()
  mockSeedFrontierFromPlan.mockResolvedValue(undefined)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.resetModules()
})

describe('admin.discovery.backfill-plan route', () => {
  test('returns 403 when DISCOVERY_V2 disabled', async () => {
    delete process.env.DISCOVERY_V2

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=test'))
    expect(response.status).toBe(403)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('returns 503 when global kill switch active', async () => {
    process.env.DISCOVERY_V2 = 'true'
    process.env.DISCOVERY_KILLSWITCH = 'true'

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=test'))
    expect(response.status).toBe(503)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('returns 423 when patch is force-stopped', async () => {
    process.env.DISCOVERY_V2 = 'true'
    process.env.DISCOVERY_V2_FORCE_STOP_PATCHES = 'demo-patch'

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=demo-patch'))
    expect(response.status).toBe(423)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('returns 404 when patch is missing', async () => {
    process.env.DISCOVERY_V2 = 'true'

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue(null)

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=unknown'))
    expect(response.status).toBe(404)
    expect(mockFindUnique).toHaveBeenCalled()
  })

  test('returns summary when plan exists', async () => {
    process.env.DISCOVERY_V2 = 'true'

    const plan = {
      seedCandidates: [
        { url: 'https://example.com/a' },
        { url: 'https://example.org/b' }
      ],
      contentQueries: {}
    }

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue({
      id: 'patch-123',
      handle: 'demo',
      title: 'Demo Patch',
      tags: [],
      entity: null,
      guide: plan
    })

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=demo'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.seedsQueued).toBe(2)
    expect(Array.isArray(body.hosts)).toBe(true)
    expect(mockSeedFrontierFromPlan).toHaveBeenCalledWith('patch-123', plan)
    expect(mockGenerateGuideSnapshot).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('generates and persists plan when missing', async () => {
    process.env.DISCOVERY_V2 = 'true'

    const generatedPlan = {
      seedCandidates: [{ url: 'https://source.example.com/story' }],
      contentQueries: {}
    }

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue({
      id: 'patch-456',
      handle: 'fresh',
      title: 'Fresh Patch',
      tags: ['Tag One'],
      entity: null,
      guide: null
    })
    mockGenerateGuideSnapshot.mockResolvedValue(generatedPlan)

    jest.resetModules()
    const { POST } = await import('@/app/api/admin/discovery/backfill-plan/route')

    const response = await POST(buildRequest('http://localhost/api/admin/discovery/backfill-plan?patch=fresh'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.generated).toBe(true)
    expect(mockGenerateGuideSnapshot).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'patch-456' },
      data: { guide: generatedPlan }
    })
    expect(mockSeedFrontierFromPlan).toHaveBeenCalledWith('patch-456', generatedPlan)
  })
})


