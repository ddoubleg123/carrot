import { evaluateAcceptance, type AcceptanceCard } from '../discovery/acceptance'

describe('Discovery acceptance checks', () => {
  const plannerAngles = ['Angle A', 'Angle B']

  const buildCards = (overrides: Partial<AcceptanceCard>[] = []): AcceptanceCard[] => {
    const base: AcceptanceCard[] = [
      {
        id: 'card-1',
        canonicalUrl: 'https://example.com/a',
        angle: 'Angle A',
        viewSourceOk: true
      },
      {
        id: 'card-2',
        canonicalUrl: 'https://example.com/b',
        angle: 'Angle B',
        viewSourceOk: true,
        contested: true
      }
    ]

    return base.map((card, index) => ({
      ...card,
      ...(overrides[index] || {})
    }))
  }

  test('passes when all acceptance criteria are satisfied', () => {
    const result = evaluateAcceptance({
      timeToFirstMs: 3200,
      savedCards: buildCards(),
      plannerAngles,
      contestedClaims: ['Claim 1']
    })

    expect(result.passes).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  test('fails when time-to-first exceeds threshold', () => {
    const result = evaluateAcceptance({
      timeToFirstMs: 4800,
      savedCards: buildCards(),
      plannerAngles,
      contestedClaims: ['Claim 1']
    })

    expect(result.passes).toBe(false)
    expect(result.failures).toContain(expect.stringContaining('time_to_first_exceeded'))
  })

  test('fails when not all planner angles are covered within the window', () => {
    const result = evaluateAcceptance({
      timeToFirstMs: 2500,
      savedCards: buildCards([{ angle: 'Angle A' }, { angle: undefined }]),
      plannerAngles,
      contestedClaims: ['Claim 1']
    })

    expect(result.passes).toBe(false)
    expect(result.failures).toContain('angle_coverage_missing:Angle B')
  })

  test('fails when duplicate canonical URLs are saved', () => {
    const result = evaluateAcceptance({
      timeToFirstMs: 2500,
      savedCards: buildCards([{ canonicalUrl: 'https://dup.example.com' }, { canonicalUrl: 'https://dup.example.com' }]),
      plannerAngles,
      contestedClaims: ['Claim 1']
    })

    expect(result.passes).toBe(false)
    expect(result.failures).toContain('duplicate_canonical_url:https://dup.example.com')
  })

  test('fails when any saved card has a broken source link', () => {
    const result = evaluateAcceptance({
      timeToFirstMs: 2500,
      savedCards: buildCards([{ viewSourceOk: false }]),
      plannerAngles,
      contestedClaims: ['Claim 1']
    })

    expect(result.passes).toBe(false)
    expect(result.failures).toContain('view_source_failed')
  })

  test('fails when contested coverage is missing within the first ten saves', () => {
    const cards = buildCards([{ contested: false }, { contested: false }])

    const result = evaluateAcceptance({
      timeToFirstMs: 2500,
      savedCards: cards,
      plannerAngles,
      contestedClaims: ['Claim 1'],
      contestedWindow: 2
    })

    expect(result.passes).toBe(false)
    expect(result.failures).toContain('contested_missing_within_window')
  })
})
