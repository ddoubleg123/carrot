import { uncheckedRail, type RailItem } from '../live/now'

function row(presence: RailItem['presence'], playId: string | null): RailItem {
  return {
    id: 'absi',
    name: 'Absi',
    platform: 'kick',
    url: 'https://kick.com/absi',
    presence,
    title: null,
    playId,
    viewers: null,
    startsAt: null,
    thumb: null,
    category: 'gaming'
  }
}

describe('an unchecked rail is not a reason to stop a player', () => {
  it('treats a list where nobody has been checked as unchecked', () => {
    expect(uncheckedRail([row('offline', null), { ...row('offline', null), id: 'hasan' }])).toBe(true)
  })

  it('keeps a list once one channel has a player', () => {
    expect(uncheckedRail([row('live', 'absi'), row('offline', null)])).toBe(false)
  })
})
