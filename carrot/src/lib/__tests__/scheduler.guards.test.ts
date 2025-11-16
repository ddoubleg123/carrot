jest.mock('../redis/discovery', () => ({
  getSuccessRates: jest.fn().mockResolvedValue({}),
  setSuccessRate: jest.fn(),
  getZeroSaveDiagnostics: jest.fn().mockResolvedValue(null),
  setZeroSaveDiagnostics: jest.fn(),
  clearZeroSaveDiagnostics: jest.fn(),
  setRunState: jest.fn()
}))

import { SchedulerGuards } from '../discovery/scheduler'

function createCandidate(host: string | null = 'example.com') {
  return {
    id: 'candidate',
    provider: 'direct',
    cursor: `https://${host ?? 'example.com'}/story/path`,
    priority: 100,
    meta: { host }
  }
}

describe('SchedulerGuards', () => {
  it('down-weights wikipedia hosts when the guard is active', () => {
    let current = Date.now()
    const guards = new SchedulerGuards({ patchId: 'test', redisPatchId: 'shadow::test', now: () => current })

    // Record attempts so that wikipedia exceeds 30% share in window
    for (let i = 0; i < 7; i += 1) {
      current += 1000
      guards.recordAttempt({
        timestamp: current,
        host: i < 3 ? 'en.wikipedia.org' : 'news.example.com',
        isContested: false,
        isWikipedia: i < 3
      })
    }

    const evaluation = guards.evaluateCandidate({
      candidate: createCandidate('en.wikipedia.org'),
      host: 'en.wikipedia.org',
      isContested: false
    })

    expect(evaluation.action).toBe('requeue')
    expect(evaluation.reason).toBe('wiki_guard')
  })

  it('applies success-rate penalties for failing hosts', () => {
    let current = Date.now()
    const guards = new SchedulerGuards({ patchId: 'test', redisPatchId: 'shadow::test', now: () => current })

    guards.updateSuccessRate('slow.example.com', 'failure')
    guards.updateSuccessRate('slow.example.com', 'failure')
    current += 2000

    const evaluation = guards.evaluateCandidate({
      candidate: createCandidate('slow.example.com'),
      host: 'slow.example.com',
      isContested: false
    })

    expect(evaluation.action).toBe('requeue')
    expect(evaluation.reason).toBe('success_bias')
  })

  it('caps hosts after exceeding the per-host attempt limit', () => {
    let current = Date.now()
    const guards = new SchedulerGuards({ patchId: 'test', redisPatchId: 'shadow::test', now: () => current, hostAttemptCap: 2 })

    for (let i = 0; i < 2; i += 1) {
      current += 1000
      guards.recordAttempt({
        timestamp: current,
        host: 'cap.example.com',
        isContested: false,
        isWikipedia: false
      })
    }

    const evaluation = guards.evaluateCandidate({
      candidate: createCandidate('cap.example.com'),
      host: 'cap.example.com',
      isContested: false
    })

    expect(evaluation.action).toBe('requeue')
    expect(evaluation.reason).toBe('host_cap')
  })

  it('requeues wikipedia hosts when diversity threshold not met', () => {
    let current = Date.now()
    const guards = new SchedulerGuards({ patchId: 'test', redisPatchId: 'shadow::test', now: () => current })

    const hosts = ['news.one.com', 'news.one.com', 'media.two.org', 'media.two.org']
    hosts.forEach((host) => {
      current += 500
      guards.recordAttempt({
        timestamp: current,
        host,
        isContested: false,
        isWikipedia: false
      })
    })

    const evaluation = guards.evaluateCandidate({
      candidate: createCandidate('en.wikipedia.org'),
      host: 'en.wikipedia.org',
      isContested: false
    })

    expect(evaluation.action).toBe('requeue')
    expect(evaluation.reason).toBe('wiki_low_diversity')
  })

  it('flags reseed need when host diversity stays below target window', () => {
    let current = Date.now()
    const guards = new SchedulerGuards({ patchId: 'test', redisPatchId: 'shadow::test', now: () => current })
    const hosts = ['one.com', 'one.com', 'one.com', 'two.org', 'two.org', 'two.org']
    hosts.forEach((host) => {
      current += 500
      guards.recordAttempt({
        timestamp: current,
        host,
        isContested: false,
        isWikipedia: host.includes('wikipedia')
      })
    })

    expect(guards.needsReseed()).toBe(true)
  })
})

