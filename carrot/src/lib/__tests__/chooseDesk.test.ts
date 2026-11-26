import { chooseDesk } from '../curator/assign'
import { DESKS } from '../curator/desks'
import { outletFromContent } from '../curator/variety'

describe('chooseDesk', () => {
  it('sends a current Israel story to Israel and Palestine', () => {
    expect(chooseDesk('Ceasefire talks in Gaza as Israel and Hamas meet').id).toBe('olive-ledger')
  })

  it('sends the Balfour Declaration to How Israel Started', () => {
    expect(chooseDesk('The Balfour Declaration and the British Mandate in 1917').id).toBe('mandate-file')
  })

  it('leaves an engineering page on the unsorted account', () => {
    expect(chooseDesk('How a jet engine compressor stage works').id).toBe('finds')
    expect(chooseDesk('How a jet engine compressor stage works').name).toBe('Everything Else')
  })

  it('gives every group a page, a feed, or a channel it can read', () => {
    const quiet = DESKS.filter((desk) => !desk.sources.some((source) => (
      source.kind === 'rss' || source.kind === 'site' || source.kind === 'query' || source.kind === 'youtube'
    )))
    expect(quiet.map((desk) => desk.name)).toEqual([])
  })

  it('reads the publisher on a saved quote card', () => {
    expect(outletFromContent('kind: quote\nsource: The Hill\n\nThe sentence is here.')).toBe('the hill')
  })
})
