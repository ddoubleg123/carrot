export const PATCH_RANKS = [
  { name: 'Seed', at: 0 },
  { name: 'Sprout', at: 25 },
  { name: 'Row', at: 80 },
  { name: 'Harvest', at: 200 },
  { name: 'Stand', at: 500 },
]

const RANKS = PATCH_RANKS

export function patchRank(earned: number) {
  const safe = Number.isFinite(earned) && earned > 0 ? Math.floor(earned) : 0
  let index = 0
  for (let i = 0; i < RANKS.length; i++) {
    if (safe >= RANKS[i].at) index = i
  }
  const current = RANKS[index]
  const next = RANKS[index + 1] || null
  const span = next ? next.at - current.at : 1
  const into = safe - current.at
  const plots = 10
  const filled = next ? Math.min(plots, Math.floor((into / span) * plots)) : plots
  const left = next ? Math.max(0, next.at - safe) : 0
  return {
    name: current.name,
    at: current.at,
    next: next?.name ?? null,
    filled,
    plots,
    left,
  }
}
