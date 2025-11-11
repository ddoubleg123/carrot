import { resolvePatch } from '../redis/keys'

describe('redis discovery namespace helpers', () => {
  it('marks shadow namespaces correctly', () => {
    expect(resolvePatch('shadow::abc')).toEqual({ id: 'abc', shadow: true })
    expect(resolvePatch('plain-id')).toEqual({ id: 'plain-id', shadow: false })
  })
})

