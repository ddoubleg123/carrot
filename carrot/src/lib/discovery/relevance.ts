/**
 * Entity-scoped Relevance Filtering for Discovery
 * Ensures content is relevant to the group's topic
 */

export interface EntityProfile {
  groupId: string
  groupName: string
  primaryEntities: string[]
  people: string[]
  places: string[]
  rivals: string[]
  keywords: string[]
  domains: string[]
}

export interface RelevanceResult {
  isRelevant: boolean
  score: number
  reason?: string
  matchedEntities: string[]
}

export class RelevanceEngine {
  private entityProfiles = new Map<string, EntityProfile>()
  
  /**
   * Build entity profile for a group
   */
  async buildEntityProfile(groupId: string, groupName: string): Promise<EntityProfile> {
    // This would typically use NER and knowledge graphs
    // For now, we'll use predefined profiles for known groups
    
    const profile = this.getPredefinedProfile(groupName)
    this.entityProfiles.set(groupId, profile)
    return profile
  }
  
  /**
   * Check if content is relevant to the group
   */
  async checkRelevance(
    groupId: string,
    title: string,
    content: string,
    domain: string
  ): Promise<RelevanceResult> {
    const profile = this.entityProfiles.get(groupId)
    if (!profile) {
      return {
        isRelevant: false,
        score: 0,
        reason: 'No entity profile found for group',
        matchedEntities: []
      }
    }
    
    const text = `${title} ${content}`.toLowerCase()
    const matchedEntities: string[] = []
    let score = 0
    
    // Check for primary entities (highest weight)
    for (const entity of profile.primaryEntities) {
      if (text.includes(entity.toLowerCase())) {
        matchedEntities.push(entity)
        score += 0.4
      }
    }
    
    // Check for people (high weight)
    for (const person of profile.people) {
      if (text.includes(person.toLowerCase())) {
        matchedEntities.push(person)
        score += 0.3
      }
    }
    
    // Check for places (medium weight)
    for (const place of profile.places) {
      if (text.includes(place.toLowerCase())) {
        matchedEntities.push(place)
        score += 0.2
      }
    }
    
    // Check for keywords (medium weight)
    for (const keyword of profile.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedEntities.push(keyword)
        score += 0.15
      }
    }
    
    // Check for domain trust (low weight)
    if (profile.domains.includes(domain)) {
      score += 0.1
    }
    
    // Penalty for league-general content without group mentions
    if (this.isLeagueGeneral(text) && !this.hasGroupMention(text, profile)) {
      score -= 0.3
    }
    
    // Ensure at least one group-specific entity is present
    const hasGroupMention = profile.primaryEntities.some(entity => 
      text.includes(entity.toLowerCase())
    ) || profile.people.some(person => 
      text.includes(person.toLowerCase())
    )
    
    const isRelevant = score >= 0.7 && hasGroupMention
    
    return {
      isRelevant,
      score: Math.max(0, Math.min(1, score)),
      reason: isRelevant ? undefined : 'Insufficient relevance score or missing group mentions',
      matchedEntities
    }
  }
  
  /**
   * Get predefined entity profile for known groups
   */
  private getPredefinedProfile(groupName: string): EntityProfile {
    switch (groupName.toLowerCase()) {
      case 'chicago bulls':
        return {
          groupId: 'chicago-bulls',
          groupName: 'Chicago Bulls',
          primaryEntities: [
            'Chicago Bulls',
            'Bulls',
            'CHI',
            'Madhouse on Madison',
            'United Center'
          ],
          people: [
            'Michael Jordan',
            'Scottie Pippen',
            'Phil Jackson',
            'Derrick Rose',
            'Jerry Krause',
            'Dennis Rodman',
            'Toni Kukoc',
            'Steve Kerr',
            'Horace Grant',
            'B.J. Armstrong'
          ],
          places: [
            'Chicago',
            'United Center',
            'Madison Square Garden',
            'Los Angeles'
          ],
          rivals: [
            'Detroit Pistons',
            'New York Knicks',
            'Utah Jazz',
            'Miami Heat',
            'Boston Celtics'
          ],
          keywords: [
            'basketball',
            'NBA',
            'championship',
            'dynasty',
            'playoffs',
            'finals',
            'coach',
            'roster',
            'trade',
            'draft'
          ],
          domains: [
            'nba.com',
            'espn.com',
            'sports.yahoo.com',
            'chicagotribune.com',
            'chicagosuntimes.com'
          ]
        }
        
      case 'houston rockets':
        return {
          groupId: 'houston-rockets',
          groupName: 'Houston Rockets',
          primaryEntities: [
            'Houston Rockets',
            'Rockets',
            'HOU',
            'Toyota Center'
          ],
          people: [
            'Hakeem Olajuwon',
            'Yao Ming',
            'Tracy McGrady',
            'James Harden',
            'Chris Paul',
            'Russell Westbrook',
            'Rudy Tomjanovich'
          ],
          places: [
            'Houston',
            'Toyota Center',
            'Texas'
          ],
          rivals: [
            'Dallas Mavericks',
            'San Antonio Spurs',
            'Utah Jazz'
          ],
          keywords: [
            'basketball',
            'NBA',
            'championship',
            'playoffs',
            'finals'
          ],
          domains: [
            'nba.com',
            'espn.com',
            'sports.yahoo.com',
            'chron.com',
            'houstonchronicle.com'
          ]
        }
        
      default:
        // Generic profile for unknown groups
        return {
          groupId: groupName.toLowerCase().replace(/\s+/g, '-'),
          groupName,
          primaryEntities: [groupName],
          people: [],
          places: [],
          rivals: [],
          keywords: [],
          domains: []
        }
    }
  }
  
  /**
   * Check if content is league-general without group mentions
   */
  private isLeagueGeneral(text: string): boolean {
    const leagueGeneralTerms = [
      'nba',
      'basketball',
      'league',
      'season',
      'playoffs',
      'championship',
      'finals'
    ]
    
    return leagueGeneralTerms.some(term => text.includes(term))
  }
  
  /**
   * Check if text has group-specific mentions
   */
  private hasGroupMention(text: string, profile: EntityProfile): boolean {
    const allEntities = [
      ...profile.primaryEntities,
      ...profile.people,
      ...profile.places
    ]
    
    return allEntities.some(entity => text.includes(entity.toLowerCase()))
  }
  
  /**
   * Get entity profile for a group
   */
  getEntityProfile(groupId: string): EntityProfile | undefined {
    return this.entityProfiles.get(groupId)
  }
  
  /**
   * Update entity profile
   */
  updateEntityProfile(groupId: string, profile: Partial<EntityProfile>): void {
    const existing = this.entityProfiles.get(groupId)
    if (existing) {
      this.entityProfiles.set(groupId, { ...existing, ...profile })
    }
  }
}