/**
 * Discovery audit trail and telemetry
 * Tracks every step of the discovery process for verification
 */

export interface AuditStep {
  timestamp: number
  type: string
  data: any
  duration?: number
}

export interface AuditTrail {
  id: string
  groupId: string
  itemId?: string
  steps: AuditStep[]
  startTime: number
  endTime?: number
  duration?: number
  decision: 'saved' | 'skipped'
  reason?: string
  finalScore?: number
}

export interface AuditStats {
  totalItems: number
  savedItems: number
  skippedItems: number
  averageDuration: number
  topReasons: Array<{reason: string, count: number}>
  stepDurations: Record<string, number>
}

/**
 * Discovery audit logger
 */
export class DiscoveryAuditLogger {
  private trails = new Map<string, AuditTrail>()
  private currentTrail?: AuditTrail
  
  /**
   * Start a new audit trail
   */
  startTrail(groupId: string, itemId?: string): string {
    const trailId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const trail: AuditTrail = {
      id: trailId,
      groupId,
      itemId,
      steps: [],
      startTime: Date.now(),
      decision: 'skipped'
    }
    
    this.trails.set(trailId, trail)
    this.currentTrail = trail
    
    return trailId
  }
  
  /**
   * Add a step to the current trail
   */
  addStep(type: string, data: any, duration?: number): void {
    if (!this.currentTrail) return
    
    const step: AuditStep = {
      timestamp: Date.now(),
      type,
      data,
      duration
    }
    
    this.currentTrail.steps.push(step)
  }
  
  /**
   * Complete the current trail
   */
  completeTrail(decision: 'saved' | 'skipped', reason?: string, finalScore?: number): void {
    if (!this.currentTrail) return
    
    this.currentTrail.endTime = Date.now()
    this.currentTrail.duration = this.currentTrail.endTime - this.currentTrail.startTime
    this.currentTrail.decision = decision
    this.currentTrail.reason = reason
    this.currentTrail.finalScore = finalScore
    
    // Store in database (this would be implemented with Prisma)
    this.storeAuditTrail(this.currentTrail)
    
    this.currentTrail = undefined
  }
  
  /**
   * Get audit trail by ID
   */
  getTrail(trailId: string): AuditTrail | null {
    return this.trails.get(trailId) || null
  }
  
  /**
   * Get audit trails for a group
   */
  getGroupTrails(groupId: string, limit: number = 50): AuditTrail[] {
    const groupTrails = Array.from(this.trails.values())
      .filter(trail => trail.groupId === groupId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
    
    return groupTrails
  }
  
  /**
   * Get audit statistics
   */
  getStats(groupId: string): AuditStats {
    const trails = Array.from(this.trails.values())
      .filter(trail => trail.groupId === groupId)
    
    const totalItems = trails.length
    const savedItems = trails.filter(t => t.decision === 'saved').length
    const skippedItems = trails.filter(t => t.decision === 'skipped').length
    
    const averageDuration = trails.length > 0 
      ? trails.reduce((sum, trail) => sum + (trail.duration || 0), 0) / trails.length
      : 0
    
    // Count reasons
    const reasonCounts = new Map<string, number>()
    trails.forEach(trail => {
      if (trail.reason) {
        reasonCounts.set(trail.reason, (reasonCounts.get(trail.reason) || 0) + 1)
      }
    })
    
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    // Calculate step durations
    const stepDurations: Record<string, number[]> = {}
    trails.forEach(trail => {
      trail.steps.forEach(step => {
        if (step.duration) {
          if (!stepDurations[step.type]) {
            stepDurations[step.type] = []
          }
          stepDurations[step.type].push(step.duration)
        }
      })
    })
    
    const avgStepDurations: Record<string, number> = {}
    Object.entries(stepDurations).forEach(([type, durations]) => {
      avgStepDurations[type] = durations.reduce((sum, dur) => sum + dur, 0) / durations.length
    })
    
    return {
      totalItems,
      savedItems,
      skippedItems,
      averageDuration,
      topReasons,
      stepDurations: avgStepDurations
    }
  }
  
  /**
   * Store audit trail in database
   */
  private async storeAuditTrail(trail: AuditTrail): Promise<void> {
    try {
      // This would use Prisma to store in database
      // For now, we'll just log it
      console.log('[AuditLogger] Storing trail:', {
        id: trail.id,
        groupId: trail.groupId,
        decision: trail.decision,
        duration: trail.duration,
        stepCount: trail.steps.length
      })
    } catch (error) {
      console.error('[AuditLogger] Failed to store trail:', error)
    }
  }
  
  /**
   * Clear old trails (cleanup)
   */
  clearOldTrails(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge
    const toDelete: string[] = []
    
    this.trails.forEach((trail, id) => {
      if (trail.startTime < cutoff) {
        toDelete.push(id)
      }
    })
    
    toDelete.forEach(id => this.trails.delete(id))
  }
}

/**
 * Predefined audit step types
 */
export const AuditStepTypes = {
  PROVIDER_FETCH: 'provider_fetch',
  URL_CANONICALIZE: 'url_canonicalize',
  DUPLICATE_CHECK: 'duplicate_check',
  RELEVANCE_SCORE: 'relevance_score',
  CONTENT_EXTRACT: 'content_extract',
  CONTENT_SUMMARIZE: 'content_summarize',
  HERO_SELECT: 'hero_select',
  HERO_GENERATE: 'hero_generate',
  QUALITY_VALIDATE: 'quality_validate',
  DATABASE_SAVE: 'database_save',
  ERROR: 'error'
} as const

/**
 * Create audit step data for common operations
 */
export class AuditStepData {
  static providerFetch(source: string, urlsFound: number, duration: number) {
    return {
      source,
      urlsFound,
      duration
    }
  }
  
  static urlCanonicalize(originalUrl: string, canonicalUrl: string) {
    return {
      originalUrl,
      canonicalUrl
    }
  }
  
  static duplicateCheck(result: 'unique' | 'duplicate', tier: string, similarity?: number) {
    return {
      result,
      tier,
      similarity
    }
  }
  
  static relevanceScore(score: number, breakdown: any, passed: boolean) {
    return {
      score,
      breakdown,
      passed
    }
  }
  
  static contentExtract(wordCount: number, readingTime: number, duration: number) {
    return {
      wordCount,
      readingTime,
      duration
    }
  }
  
  static contentSummarize(summaryLength: number, keyPointsCount: number, duration: number) {
    return {
      summaryLength,
      keyPointsCount,
      duration
    }
  }
  
  static heroSelect(source: string, url: string, dimensions: {width: number, height: number}) {
    return {
      source,
      url,
      dimensions
    }
  }
  
  static heroGenerate(prompt: string, duration: number) {
    return {
      prompt,
      duration
    }
  }
  
  static qualityValidate(score: number, issues: string[], passed: boolean) {
    return {
      score,
      issues,
      passed
    }
  }
  
  static databaseSave(itemId: string, duration: number) {
    return {
      itemId,
      duration
    }
  }
  
  static error(error: string, step: string) {
    return {
      error,
      step
    }
  }
}

// Global audit logger instance
export const auditLogger = new DiscoveryAuditLogger()
