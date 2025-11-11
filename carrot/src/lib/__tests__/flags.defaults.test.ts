export {}

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.resetModules()
})

describe('discovery flags – defaults and parsing', () => {
  test('uses safe defaults when env vars are unset', async () => {
    delete process.env.DISCOVERY_V2
    delete process.env.DISCOVERY_V2_SHADOW_MODE
    delete process.env.DISCOVERY_V2_WRITE_MODE
    delete process.env.DISCOVERY_V2_GUARD_STRICT_SEEDS
    delete process.env.DISCOVERY_V2_FORCE_STOP_PATCHES

    const flags = await import('../flags')

    expect(flags.DISCOVERY_V2).toBe(false)
    expect(flags.DISCOVERY_V2_SHADOW_MODE).toBe(false)
    expect(flags.DISCOVERY_V2_WRITE_MODE).toBe(false)
    expect(flags.DISCOVERY_V2_GUARD_STRICT_SEEDS).toBe(false)
    expect(flags.DISCOVERY_V2_FORCE_STOP_PATCHES.size).toBe(0)

    const refreshed = flags.refreshFlags()
    expect(refreshed.DISCOVERY_V2).toBe(false)
    expect(refreshed.DISCOVERY_V2_FORCE_STOP_PATCHES.size).toBe(0)
  })

  test('parses CSV stop list and boolean flags', async () => {
    process.env.DISCOVERY_V2 = 'true'
    process.env.DISCOVERY_V2_SHADOW_MODE = '1'
    process.env.DISCOVERY_V2_WRITE_MODE = 'yes'
    process.env.DISCOVERY_V2_GUARD_STRICT_SEEDS = 'on'
    process.env.DISCOVERY_V2_FORCE_STOP_PATCHES = 'Alpha , beta,  Gamma  '

    const flags = await import('../flags')

    expect(flags.DISCOVERY_V2).toBe(true)
    expect(flags.DISCOVERY_V2_SHADOW_MODE).toBe(true)
    expect(flags.DISCOVERY_V2_WRITE_MODE).toBe(true)
    expect(flags.DISCOVERY_V2_GUARD_STRICT_SEEDS).toBe(true)

    expect(flags.DISCOVERY_V2_FORCE_STOP_PATCHES.has('alpha')).toBe(true)
    expect(flags.DISCOVERY_V2_FORCE_STOP_PATCHES.has('beta')).toBe(true)
    expect(flags.DISCOVERY_V2_FORCE_STOP_PATCHES.has('gamma')).toBe(true)
    expect(flags.DISCOVERY_V2_FORCE_STOP_PATCHES.has('delta')).toBe(false)

    const refreshed = flags.refreshFlags()
    expect(refreshed.DISCOVERY_V2_FORCE_STOP_PATCHES.has('alpha')).toBe(true)
  })
})


