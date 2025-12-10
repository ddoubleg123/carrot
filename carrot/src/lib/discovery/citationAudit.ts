/**
 * Citation Audit System
 * Identifies citations that should be reprocessed based on audit criteria
 * Replaces time-based rules with intelligent anomaly detection
 */

import { Prisma } from '@prisma/client'

export interface CitationAuditResult {
  shouldReprocess: boolean
  auditScore: number // 0-100, higher = more likely needs reprocessing
  reasons: string[]
  priority: 'high' | 'medium' | 'low'
}

/**
 * Audit a citation to determine if it should be reprocessed
 * Uses anomaly detection rather than time-based rules
 */
export function auditCitationForReprocessing(citation: {
  aiPriorityScore: number | null
  relevanceDecision: string | null
  verificationStatus: string | null
  scanStatus: string | null
  contentText: string | null
  lastScannedAt: Date | null
  createdAt: Date
  citationUrl: string
}): CitationAuditResult {
  const reasons: string[] = []
  let auditScore = 0

  // Only audit denied citations (saved ones don't need reprocessing)
  if (citation.relevanceDecision !== 'denied') {
    return {
      shouldReprocess: false,
      auditScore: 0,
      reasons: [],
      priority: 'low'
    }
  }

  // CRITICAL ANOMALY: High AI score but denied
  // This is the strongest signal - AI says it's relevant but we denied it
  if (citation.aiPriorityScore !== null && citation.aiPriorityScore >= 60) {
    const scoreWeight = Math.min(citation.aiPriorityScore, 100) // Cap at 100
    auditScore += scoreWeight * 0.6 // 60% weight for AI score
    
    if (citation.aiPriorityScore >= 80) {
      reasons.push(`CRITICAL: AI score ${citation.aiPriorityScore} but denied (very high confidence)`)
    } else if (citation.aiPriorityScore >= 70) {
      reasons.push(`HIGH: AI score ${citation.aiPriorityScore} but denied (high confidence)`)
    } else {
      reasons.push(`MEDIUM: AI score ${citation.aiPriorityScore} but denied (above threshold)`)
    }
  }

  // ANOMALY: Verified URL with substantial content but denied
  // If URL works and has content, why was it denied?
  if (citation.verificationStatus === 'verified' && citation.contentText) {
    const contentLength = citation.contentText.length
    
    if (contentLength >= 5000) {
      auditScore += 20
      reasons.push(`Substantial content (${contentLength} chars) but denied`)
    } else if (contentLength >= 2000) {
      auditScore += 10
      reasons.push(`Good content length (${contentLength} chars) but denied`)
    }
  }

  // ANOMALY: Content exists but was denied
  // If we extracted content, it passed basic checks - why deny?
  if (citation.contentText && citation.contentText.length >= 1000) {
    auditScore += 5
    reasons.push(`Content extracted (${citation.contentText.length} chars) but denied`)
  }

  // ANOMALY: Recently scanned but denied with high score
  // If we just scanned it and it scored high but was denied, might be a recent bug
  if (citation.lastScannedAt && citation.aiPriorityScore !== null && citation.aiPriorityScore >= 60) {
    const daysSinceScan = Math.floor((Date.now() - citation.lastScannedAt.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceScan <= 7) {
      auditScore += 10
      reasons.push(`Recently scanned (${daysSinceScan} days ago) with high score but denied - possible recent bug`)
    }
  }

  // ANOMALY: External URL (not Wikipedia) that was verified but denied
  // External URLs that verify are usually good sources
  const isExternalUrl = !citation.citationUrl.includes('wikipedia.org') && 
                        !citation.citationUrl.includes('wikimedia.org') &&
                        !citation.citationUrl.includes('wikidata.org')
  
  if (isExternalUrl && citation.verificationStatus === 'verified' && citation.aiPriorityScore !== null && citation.aiPriorityScore >= 60) {
    auditScore += 5
    reasons.push(`Verified external URL with high score but denied`)
  }

  // Determine if should reprocess
  // Threshold: auditScore >= 50 means strong anomaly
  const shouldReprocess = auditScore >= 50

  // Determine priority
  let priority: 'high' | 'medium' | 'low' = 'low'
  if (auditScore >= 70) {
    priority = 'high'
  } else if (auditScore >= 50) {
    priority = 'medium'
  }

  return {
    shouldReprocess,
    auditScore: Math.min(auditScore, 100), // Cap at 100
    reasons,
    priority
  }
}

/**
 * Get the audit criteria summary for documentation
 */
export function getAuditCriteria(): {
  criteria: Array<{ name: string; description: string; weight: string }>
  threshold: string
} {
  return {
    criteria: [
      {
        name: 'High AI Score + Denied',
        description: 'AI score >= 60 but citation was denied. Strongest signal of incorrect denial.',
        weight: 'Up to 60 points (based on AI score, capped at 100)'
      },
      {
        name: 'Substantial Content + Denied',
        description: 'Content length >= 5000 chars but denied. If we extracted this much content, it likely passed basic checks.',
        weight: '20 points'
      },
      {
        name: 'Good Content + Denied',
        description: 'Content length >= 2000 chars but denied.',
        weight: '10 points'
      },
      {
        name: 'Content Extracted + Denied',
        description: 'Content exists (>= 1000 chars) but denied.',
        weight: '5 points'
      },
      {
        name: 'Recent Scan + High Score + Denied',
        description: 'Scanned within 7 days with high score but denied. Might indicate a recent bug.',
        weight: '10 points'
      },
      {
        name: 'Verified External URL + High Score + Denied',
        description: 'External URL verified with high score but denied.',
        weight: '5 points'
      }
    ],
    threshold: 'Audit score >= 50 triggers reprocessing. Higher scores = higher priority.'
  }
}

