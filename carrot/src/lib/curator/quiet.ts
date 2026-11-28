/** How long a group may go without a saved post before one extra read. */
export const QUIET_GAP_MS = 6 * 60 * 60 * 1000

/** How often the hunt asks the database which groups saved something inside the gap. */
export const QUIET_LOOK_MS = 10 * 60 * 1000

/** What Your Representative Did stores its posts on the pol-watch bucket. */
export function postBucket(deskId: string): string {
  return deskId === 'member-card' ? 'pol-watch' : deskId
}

/**
 * One group that has no save inside the gap and was not forced inside the gap.
 * Groups already being read on this pass are left to that read.
 * The oldest try goes first, so a miss waits its turn instead of jumping the line.
 */
export function pickQuietGroup(
  ids: string[],
  savedBuckets: ReadonlySet<string>,
  tried: Record<string, number>,
  now: number,
  gap = QUIET_GAP_MS,
  busy: ReadonlySet<string> = new Set()
): string | null {
  const due = ids.filter((id) => {
    if (busy.has(id)) return false
    if (savedBuckets.has(postBucket(id))) return false
    const at = tried[id] || 0
    return now - at >= gap
  })
  if (due.length === 0) return null
  due.sort((a, b) => (tried[a] || 0) - (tried[b] || 0) || a.localeCompare(b))
  return due[0]
}
