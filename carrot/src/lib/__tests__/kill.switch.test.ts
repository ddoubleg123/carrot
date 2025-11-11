export {}

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.resetModules()
})

describe('discovery kill switch helpers', () => {
  test('patch force stop list is case-insensitive', async () => {
    process.env.DISCOVERY_V2_FORCE_STOP_PATCHES = 'ExamplePatch,patch-002'

    jest.resetModules()
    const flags = await import('../discovery/flags')

    expect(flags.isPatchForceStopped('examplepatch')).toBe(true)
    expect(flags.isPatchForceStopped('PATCH-002')).toBe(true)
    expect(flags.isPatchForceStopped('patch-003')).toBe(false)
  })

  test('kill switch reflects env flag', async () => {
    process.env.DISCOVERY_KILLSWITCH = 'true'

    jest.resetModules()
    const flags = await import('../discovery/flags')

    expect(flags.isDiscoveryKillSwitchEnabled()).toBe(true)
  })
})


