/**
 * Group Profile System for Discovery
 * Defines entity profiles, domain allowlists, and relevance rules per group
 */

export interface GroupProfile {
  id: string
  name: string
  slug: string
  canonical_entities: string[]
  synonyms: string[]
  key_people: string[]
  allow_domains: string[]
  block_domains: string[]
  relevance_threshold: number
  embedding_threshold: number
}

export const GROUP_PROFILES: Record<string, GroupProfile> = {
  'chicago-bulls': {
    id: 'chicago-bulls',
    name: 'Chicago Bulls',
    slug: 'chicago-bulls',
    canonical_entities: [
      'Chicago Bulls',
      'Bulls',
      'Chicago Bulls basketball',
      'Bulls basketball'
    ],
    synonyms: [
      'CHI',
      'Madhouse on Madison',
      'United Center',
      'Windy City',
      'Chicago basketball',
      'Bulls team',
      'Chicago NBA'
    ],
    key_people: [
      'Michael Jordan',
      'Scottie Pippen',
      'Phil Jackson',
      'Derrick Rose',
      'Joakim Noah',
      'Luol Deng',
      'Jimmy Butler',
      'Zach LaVine',
      'DeMar DeRozan',
      'Artūras Karnišovas',
      'Billy Donovan',
      'Jerry Reinsdorf',
      'John Paxson',
      'Gar Forman'
    ],
    allow_domains: [
      'nba.com/bulls',
      'espn.com/nba/team/chi',
      'basketball-reference.com/teams/CHI',
      'chicagotribune.com/sports/bulls',
      'theathletic.com/*/bulls',
      'unitedcenter.com',
      'chicagobulls.com',
      'nba.com/team/1610612741',
      'sportsnet.ca/nba/teams/chicago-bulls',
      'cbs.com/sports/nba/teams/chicago-bulls',
      'yahoo.com/sports/nba/teams/chicago-bulls',
      'bleacherreport.com/chicago-bulls',
      'sbnation.com/chicago-bulls',
      'fansided.com/chicago-bulls'
    ],
    block_domains: [
      'generic-nba-blog.com',
      'low-quality-sports.com'
    ],
    relevance_threshold: 0.7,
    embedding_threshold: 0.48
  }
}

export function getGroupProfile(slug: string): GroupProfile | null {
  return GROUP_PROFILES[slug] || null
}

export function isRelevantToGroup(content: string, title: string, groupProfile: GroupProfile): {
  isRelevant: boolean
  score: number
  matchedEntities: string[]
  reason?: string
} {
  const text = `${title} ${content}`.toLowerCase()
  
  // Check for canonical entities (hard requirement)
  const matchedEntities: string[] = []
  for (const entity of groupProfile.canonical_entities) {
    if (text.includes(entity.toLowerCase())) {
      matchedEntities.push(entity)
    }
  }
  
  // Must match at least one canonical entity
  if (matchedEntities.length === 0) {
    return {
      isRelevant: false,
      score: 0,
      matchedEntities: [],
      reason: 'No canonical entities found'
    }
  }
  
  // Calculate relevance score
  let score = 0.5 // Base score for matching canonical entity
  
  // Bonus for key people
  for (const person of groupProfile.key_people) {
    if (text.includes(person.toLowerCase())) {
      score += 0.1
    }
  }
  
  // Bonus for synonyms
  for (const synonym of groupProfile.synonyms) {
    if (text.includes(synonym.toLowerCase())) {
      score += 0.05
    }
  }
  
  // Cap at 1.0
  score = Math.min(1.0, score)
  
  const isRelevant = score >= groupProfile.relevance_threshold
  
  return {
    isRelevant,
    score,
    matchedEntities,
    reason: isRelevant ? undefined : `Score ${score.toFixed(2)} below threshold ${groupProfile.relevance_threshold}`
  }
}
