/**
 * Relevance scoring system for discovery content
 * Combines entity matching, keyword analysis, and domain trust
 */

export interface RelevanceConfig {
  groupId: string
  entities: string[] // Team names, players, coaches, venues, etc.
  keywords: string[] // Related terms
  allowlistDomains: string[] // Trusted domains
  allowlistPaths: string[] // Trusted path patterns
}

export interface RelevanceResult {
  score: number
  passed: boolean
  breakdown: {
    entityHits: number
    keywordHits: number
    domainTrust: number
    pathMatch: boolean
  }
  reasons: string[]
}

export interface ContentDocument {
  title: string
  text: string
  url: string
  domain: string
  path: string
  meta?: {
    description?: string
    keywords?: string[]
    author?: string
  }
}

/**
 * Score content relevance for a group
 */
export function scoreRelevance(
  doc: ContentDocument,
  config: RelevanceConfig
): RelevanceResult {
  const reasons: string[] = []
  let entityHits = 0
  let keywordHits = 0
  let domainTrust = 0
  let pathMatch = false
  
  // Normalize text for matching
  const searchText = `${doc.title} ${doc.text} ${doc.meta?.description || ''}`.toLowerCase()
  
  // 1. Entity matching (60% weight)
  const entityMatches = config.entities.filter(entity => {
    const normalizedEntity = entity.toLowerCase()
    return searchText.includes(normalizedEntity) || 
           searchText.includes(normalizedEntity.replace(/\s+/g, ''))
  })
  entityHits = entityMatches.length
  if (entityHits > 0) {
    reasons.push(`Found ${entityHits} entity matches: ${entityMatches.join(', ')}`)
  }
  
  // 2. Keyword matching (20% weight)
  const keywordMatches = config.keywords.filter(keyword => {
    const normalizedKeyword = keyword.toLowerCase()
    return searchText.includes(normalizedKeyword)
  })
  keywordHits = keywordMatches.length
  if (keywordHits > 0) {
    reasons.push(`Found ${keywordHits} keyword matches: ${keywordMatches.join(', ')}`)
  }
  
  // 3. Domain trust (20% weight)
  const domain = doc.domain.toLowerCase()
  const isAllowlistedDomain = config.allowlistDomains.some(allowed => 
    domain === allowed.toLowerCase() || domain.endsWith(`.${allowed}`)
  )
  
  if (isAllowlistedDomain) {
    domainTrust = 1.0
    reasons.push(`Domain ${domain} is in allowlist`)
  } else {
    // Score based on domain reputation
    domainTrust = getDomainTrustScore(domain)
    if (domainTrust > 0.5) {
      reasons.push(`Domain ${domain} has good reputation (${domainTrust.toFixed(2)})`)
    }
  }
  
  // 4. Path matching bonus
  pathMatch = config.allowlistPaths.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i')
    return regex.test(doc.path)
  })
  
  if (pathMatch) {
    reasons.push(`Path ${doc.path} matches allowlist pattern`)
  }
  
  // Calculate final score
  const entityScore = Math.min(entityHits / Math.max(config.entities.length, 1), 1.0)
  const keywordScore = Math.min(keywordHits / Math.max(config.keywords.length, 1), 1.0)
  const pathBonus = pathMatch ? 0.1 : 0
  
  const score = (0.6 * entityScore) + (0.2 * keywordScore) + (0.2 * domainTrust) + pathBonus
  const passed = score >= 0.70
  
  if (!passed) {
    reasons.push(`Score ${score.toFixed(3)} below threshold 0.70`)
  }
  
  return {
    score,
    passed,
    breakdown: {
      entityHits,
      keywordHits,
      domainTrust,
      pathMatch
    },
    reasons
  }
}

/**
 * Get domain trust score based on known reputable domains
 */
function getDomainTrustScore(domain: string): number {
  const trustedDomains = [
    'nba.com', 'espn.com', 'sportsnet.ca', 'theathletic.com',
    'chicagotribune.com', 'chicagosuntimes.com', 'nbcchicago.com',
    'basketball-reference.com', 'stats.nba.com', 'nba.com',
    'youtube.com', 'twitter.com', 'instagram.com'
  ]
  
  const sportsDomains = [
    'sports', 'basketball', 'nba', 'basketball', 'hoops'
  ]
  
  // Exact match for trusted domains
  if (trustedDomains.includes(domain)) {
    return 0.9
  }
  
  // Subdomain of trusted domains
  if (trustedDomains.some(trusted => domain.endsWith(`.${trusted}`))) {
    return 0.8
  }
  
  // Sports-related domains
  if (sportsDomains.some(sport => domain.includes(sport))) {
    return 0.6
  }
  
  // Generic news domains
  if (domain.includes('news') || domain.includes('tribune') || domain.includes('times')) {
    return 0.5
  }
  
  // Default trust score
  return 0.3
}

/**
 * Extract entities from text using simple keyword matching
 */
export function extractEntities(text: string, entityList: string[]): string[] {
  const normalizedText = text.toLowerCase()
  return entityList.filter(entity => 
    normalizedText.includes(entity.toLowerCase())
  )
}

/**
 * Create relevance config for Chicago Bulls
 */
export function createBullsRelevanceConfig(): RelevanceConfig {
  return {
    groupId: 'chicago-bulls',
    entities: [
      'Chicago Bulls', 'Bulls', 'Chicago',
      'Michael Jordan', 'Jordan', 'MJ',
      'Scottie Pippen', 'Pippen',
      'Phil Jackson', 'Jackson',
      'Dennis Rodman', 'Rodman',
      'Derrick Rose', 'Rose',
      'Zach LaVine', 'LaVine',
      'United Center',
      'Jerry Reinsdorf',
      'Artis Gilmore',
      'Bob Love',
      'Joakim Noah',
      'Luol Deng',
      'Jimmy Butler'
    ],
    keywords: [
      'basketball', 'NBA', 'basketball team', 'professional basketball',
      'championship', 'playoffs', 'season', 'game', 'score',
      'coach', 'coaching', 'roster', 'player', 'draft',
      'trade', 'free agency', 'contract', 'injury'
    ],
    allowlistDomains: [
      'nba.com',
      'espn.com',
      'chicagotribune.com',
      'chicagosuntimes.com',
      'nbcchicago.com',
      'basketball-reference.com',
      'stats.nba.com',
      'theathletic.com'
    ],
    allowlistPaths: [
      '/nba/team/chi',
      '/nba/teams/chicago',
      '/sports/bulls',
      '/basketball/bulls',
      '/bulls'
    ]
  }
}
