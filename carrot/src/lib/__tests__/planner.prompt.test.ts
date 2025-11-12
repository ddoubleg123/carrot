jest.mock('../redis/discovery', () => ({
  addToFrontier: jest.fn(),
  storeDiscoveryPlan: jest.fn()
}))

import { __plannerPrompts } from '../discovery/planner'

describe('planner prompts', () => {
  it('includes anti-wikipedia loop safeguards in system prompt', () => {
    const system = __plannerPrompts.SYSTEM_PROMPT
    expect(system).toContain('At most ONE en.wikipedia.org seed')
    expect(system).toContain('Seeds must be deep links')
    expect(system).toContain('site filters and recency windows')
  })

  it('user prompt demands recency windows and deep links', () => {
    const prompt = __plannerPrompts.buildUserPrompt('Sample Topic', ['Alias'])
    expect(prompt).toContain('prefer recent (≤24 months)')
    expect(prompt).toContain('path depth ≥2')
    expect(prompt).toContain('"recencyWeeks"')
    expect(prompt).toContain('maxWikiSeeds')
  })
})
