/** Where the half-page sits among `count` cards: 0 is before the first, `count` is after the last. */
export function pickBoardSlot(count: number, random: () => number = Math.random) {
  if (count < 1) return -1
  return Math.floor(random() * (count + 1))
}
