import { exactHit, searchNeedles } from '@/lib/searchText'

describe('search needles', () => {
  it('treats a swapped ending as the word that was meant', () => {
    expect(searchNeedles('oracel')).toEqual([['oracel', 'oracle', 'orac']])
    expect(searchNeedles('oracle')).toEqual([['oracle', 'oracel', 'orac']])
  })

  it('keeps every word', () => {
    expect(searchNeedles('va contract')).toEqual([
      ['va'],
      ['contract', 'contratc', 'cont']
    ])
  })

  it('knows when the full phrase is in the post', () => {
    expect(exactHit('Oracle fulfilling its obligations', 'oracle')).toBe(true)
    expect(exactHit('Oracle fulfilling its obligations', 'oracel')).toBe(false)
  })
})
