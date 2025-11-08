export interface AcceptanceCard {
  id: string
  canonicalUrl: string
  angle?: string | null
  viewSourceOk: boolean
  contested?: boolean
}

export interface AcceptanceInput {
  timeToFirstMs?: number
  savedCards: AcceptanceCard[]
  plannerAngles: string[]
  contestedClaims?: string[]
  maxTimeToFirstMs?: number
  coverageWindow?: number
  contestedWindow?: number
}

export interface AcceptanceResult {
  passes: boolean
  failures: string[]
  details: {
    timeToFirstMs?: number
    coverageWindow: number
    contestedWindow: number
    anglesCovered: string[]
    contestedHitIndex?: number
  }
}

const DEFAULT_MAX_TIME_TO_FIRST_MS = 4000
const DEFAULT_COVERAGE_WINDOW = 20
const DEFAULT_CONTESTED_WINDOW = 10

export function evaluateAcceptance(input: AcceptanceInput): AcceptanceResult {
  const failures: string[] = []
  const {
    timeToFirstMs,
    savedCards,
    plannerAngles,
    contestedClaims = [],
    maxTimeToFirstMs = DEFAULT_MAX_TIME_TO_FIRST_MS,
    coverageWindow = DEFAULT_COVERAGE_WINDOW,
    contestedWindow = DEFAULT_CONTESTED_WINDOW
  } = input

  if (!Array.isArray(savedCards)) {
    throw new Error('savedCards must be an array')
  }
  if (!Array.isArray(plannerAngles)) {
    throw new Error('plannerAngles must be an array')
  }

  if (typeof timeToFirstMs === 'number' && timeToFirstMs > maxTimeToFirstMs) {
    failures.push(`time_to_first_exceeded:${timeToFirstMs}`)
  }

  const windowedCards = savedCards.slice(0, coverageWindow)
  const anglesCovered = new Set<string>()
  for (const card of windowedCards) {
    if (card.angle) {
      anglesCovered.add(card.angle)
    }
  }
  const missingAngles = plannerAngles
    .filter((angle) => Boolean(angle))
    .filter((angle) => !anglesCovered.has(angle))
  if (missingAngles.length > 0) {
    failures.push(`angle_coverage_missing:${missingAngles.join(',')}`)
  }

  const canonicalSet = new Set<string>()
  for (const card of savedCards) {
    if (!card.canonicalUrl) continue
    const lower = card.canonicalUrl.toLowerCase()
    if (canonicalSet.has(lower)) {
      failures.push(`duplicate_canonical_url:${card.canonicalUrl}`)
      break
    }
    canonicalSet.add(lower)
  }

  const hasBrokenSource = savedCards.some((card) => card.viewSourceOk === false)
  if (hasBrokenSource) {
    failures.push('view_source_failed')
  }

  let contestedHitIndex: number | undefined
  if (contestedClaims.length > 0) {
    for (let index = 0; index < Math.min(contestedWindow, savedCards.length); index++) {
      if (savedCards[index]?.contested) {
        contestedHitIndex = index
        break
      }
    }
    if (typeof contestedHitIndex === 'undefined') {
      failures.push('contested_missing_within_window')
    }
  }

  return {
    passes: failures.length === 0,
    failures,
    details: {
      timeToFirstMs,
      coverageWindow,
      contestedWindow,
      anglesCovered: Array.from(anglesCovered),
      contestedHitIndex
    }
  }
}
