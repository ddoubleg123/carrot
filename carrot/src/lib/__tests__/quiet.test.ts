import { pickQuietGroup, postBucket, QUIET_GAP_MS } from '../curator/quiet'

const GAP = QUIET_GAP_MS
const NOW = 1_700_000_000_000

describe('quiet group', () => {
  it('stores a representative post on the pol-watch bucket', () => {
    expect(postBucket('member-card')).toBe('pol-watch')
    expect(postBucket('olive-ledger')).toBe('olive-ledger')
  })

  it('picks the group that has gone longest without a forced read', () => {
    const saved = new Set(['soccer'])
    const tried = { cricket: NOW - GAP, golf: NOW - GAP - 1 }
    expect(pickQuietGroup(['soccer', 'cricket', 'golf', 'baseball'], saved, tried, NOW)).toBe('baseball')
  })

  it('waits out the gap after a try, and skips a group already in this pass', () => {
    const saved = new Set<string>()
    const tried = { baseball: NOW - 60_000 }
    expect(pickQuietGroup(['baseball'], saved, tried, NOW)).toBeNull()
    expect(pickQuietGroup(['baseball', 'golf'], saved, {}, NOW, GAP, new Set(['golf']))).toBe('baseball')
  })

  it('treats a recent pol-watch save as content for the representative group', () => {
    expect(pickQuietGroup(['member-card'], new Set(['pol-watch']), {}, NOW)).toBeNull()
    expect(pickQuietGroup(['member-card'], new Set(['member-card']), {}, NOW)).toBe('member-card')
  })

  it('returns nothing when every group saved inside the gap', () => {
    expect(pickQuietGroup(['a', 'b'], new Set(['a', 'b']), {}, NOW)).toBeNull()
    expect(pickQuietGroup([], new Set(), {}, NOW)).toBeNull()
  })
})
