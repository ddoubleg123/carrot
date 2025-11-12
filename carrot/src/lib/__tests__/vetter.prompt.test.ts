export {}

import { __vetterPrompts } from '../discovery/vetter'

describe('vetter prompts', () => {
  it('system prompt includes evidence and defamation safeguards', () => {
    const system = __vetterPrompts.SYSTEM_PROMPT
    expect(system).toContain('evidence anchors')
    expect(system).toContain('quoted word count')
    expect(system).toContain('Tier1/Tier2 credentialed citation')
    expect(system).toContain('Strip or redact PII')
  })

  it('user prompt schema includes anchors and new fields', () => {
    const prompt = __vetterPrompts.buildUserPrompt({
      topic: 'Topic',
      aliases: ['Alias'],
      url: 'https://example.com',
      text: 'Sample text'
    })
    expect(prompt).toContain('"evidence"')
    expect(prompt).toContain('"quotedWordCount"')
    expect(prompt).toContain('"isSfw"')
    expect(prompt).toContain('"publishDate"')
  })
})
