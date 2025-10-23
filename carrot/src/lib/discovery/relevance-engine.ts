/**
 * Relevance Engine for filtering content by topic relevance
 * Specifically designed for Chicago Bulls content filtering
 */

export interface RelevanceResult {
  isRelevant: boolean
  score: number
  reason: string
  entities: string[]
}

export class RelevanceEngine {
  private bullsEntities = new Set([
    // Team names and aliases
    'chicago bulls', 'bulls', 'chicago', 'chicago basketball',
    
    // Key people
    'michael jordan', 'jordan', 'mj', 'air jordan',
    'scottie pippen', 'pippen',
    'dennis rodman', 'rodman',
    'phil jackson', 'jackson',
    'tom thibodeau', 'thibodeau',
    'derrick rose', 'rose', 'd-rose',
    'demar derozan', 'derozan', 'demar',
    'zach lavine', 'lavine', 'zach',
    'nikola vucevic', 'vucevic', 'vooch',
    'coby white', 'white',
    'patrick williams', 'williams',
    'lonzo ball', 'ball',
    'alex caruso', 'caruso',
    
    // Management and ownership
    'jerry reinsdorf', 'reinsdorf',
    'arturas karnisovas', 'karnisovas',
    'marc eversley', 'eversley',
    
    // Venues and locations
    'united center', 'chicago arena',
    'chicago', 'illinois',
    
    // Historical context
    'nba championship', 'championship',
    'nba finals', 'finals',
    'playoffs', 'playoff',
    'nba', 'basketball',
    'basketball team', 'professional basketball'
  ])

  private genericTerms = new Set([
    'nba', 'basketball', 'sports', 'athlete', 'player',
    'team', 'game', 'season', 'league'
  ])

  /**
   * Check if content is relevant to Chicago Bulls
   */
  checkRelevance(
    title: string,
    content: string,
    sourceDomain: string
  ): RelevanceResult {
    const text = `${title} ${content}`.toLowerCase()
    const foundEntities = this.findEntities(text)
    const entityScore = this.calculateEntityScore(foundEntities)
    const domainScore = this.calculateDomainScore(sourceDomain)
    const genericPenalty = this.calculateGenericPenalty(text, foundEntities)
    
    const finalScore = (entityScore * 0.6) + (domainScore * 0.2) + (genericPenalty * 0.2)
    
    const isRelevant = finalScore >= 0.6
    const reason = this.generateReason(foundEntities, entityScore, domainScore, genericPenalty)
    
    return {
      isRelevant,
      score: Math.round(finalScore * 100) / 100,
      reason,
      entities: foundEntities
    }
  }

  /**
   * Find Bulls-related entities in text
   */
  private findEntities(text: string): string[] {
    const found: string[] = []
    
    for (const entity of this.bullsEntities) {
      if (text.includes(entity)) {
        found.push(entity)
      }
    }
    
    return found
  }

  /**
   * Calculate score based on found entities
   */
  private calculateEntityScore(entities: string[]): number {
    if (entities.length === 0) return 0
    
    // High-value entities (team name, key players)
    const highValue = ['chicago bulls', 'bulls', 'michael jordan', 'jordan', 'scottie pippen', 'pippen']
    const hasHighValue = entities.some(e => highValue.includes(e))
    
    // Multiple entities boost score
    const entityMultiplier = Math.min(entities.length / 3, 1)
    
    return hasHighValue ? 0.8 + (entityMultiplier * 0.2) : entityMultiplier * 0.6
  }

  /**
   * Calculate score based on source domain
   */
  private calculateDomainScore(domain: string): number {
    const trustedDomains = [
      'espn.com', 'nba.com', 'chicagotribune.com', 'chicagosuntimes.com',
      'bleacherreport.com', 'sbnation.com', 'theathletic.com'
    ]
    
    const domainLower = domain.toLowerCase()
    
    if (trustedDomains.some(d => domainLower.includes(d))) {
      return 0.8
    }
    
    if (domainLower.includes('chicago') || domainLower.includes('bulls')) {
      return 0.9
    }
    
    return 0.5
  }

  /**
   * Calculate penalty for generic content without specific Bulls context
   */
  private calculateGenericPenalty(text: string, entities: string[]): number {
    // If we have specific Bulls entities, no penalty
    if (entities.length > 0) return 0.8
    
    // Check if content is too generic
    const genericCount = Array.from(this.genericTerms).filter(term => 
      text.includes(term)
    ).length
    
    // If it's mostly generic terms without Bulls context, apply penalty
    if (genericCount >= 3 && !text.includes('bulls') && !text.includes('chicago')) {
      return 0.2
    }
    
    return 0.6
  }

  /**
   * Generate human-readable reason for relevance decision
   */
  private generateReason(
    entities: string[],
    entityScore: number,
    domainScore: number,
    genericPenalty: number
  ): string {
    if (entities.length > 0) {
      return `Found Bulls-related entities: ${entities.slice(0, 3).join(', ')}`
    }
    
    if (domainScore > 0.7) {
      return `Trusted source domain`
    }
    
    if (genericPenalty < 0.4) {
      return `Content too generic, lacks Bulls-specific context`
    }
    
    return `Insufficient Bulls relevance`
  }

  /**
   * Check if content should be hidden due to low relevance
   */
  shouldHideContent(score: number): boolean {
    return score < 0.6
  }

  /**
   * Get relevance threshold for different content types
   */
  getRelevanceThreshold(contentType: string): number {
    switch (contentType) {
      case 'news':
        return 0.7
      case 'article':
        return 0.6
      case 'video':
        return 0.5
      default:
        return 0.6
    }
  }
}
