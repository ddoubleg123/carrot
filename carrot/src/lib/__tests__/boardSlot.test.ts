import { pickBoardSlot } from '@/lib/boardSlot'

describe('pickBoardSlot', () => {
  it('returns no slot when the board is empty', () => {
    expect(pickBoardSlot(0, () => 0)).toBe(-1)
  })

  it('can sit before the first card, between cards, or after the last', () => {
    expect(pickBoardSlot(4, () => 0)).toBe(0)
    expect(pickBoardSlot(4, () => 0.5)).toBe(2)
    expect(pickBoardSlot(4, () => 0.999)).toBe(4)
  })
})
