/**
 * Search Frontier System
 * 
 * Manages search candidates with priority scoring based on:
 * - Novelty (newer content preferred)
 * - Diversity (different domains preferred)
 * - Penalty (backoff noisy sources)
 */

import { PrismaClient } from '@prisma/client';
import { DiscoveryRedis } from './redis';

const prisma = new PrismaClient();

export interface FrontierCandidate {
  source: string;
  method: string;
  cursor: string;
  priority: number;
  lastHitAt: Date;
  duplicateHitRate: number;
}

export interface SearchProvider {
  name: string;
  type: 'rss' | 'api' | 'web' | 'youtube' | 'reddit';
  baseUrl: string;
  rateLimit: number;
  priority: number;
}

/**
 * Search Frontier Manager
 */
export class SearchFrontier {
  private groupId: string;
  
  constructor(groupId: string) {
    this.groupId = groupId;
  }
  
  /**
   * Add candidate to frontier
   */
  async addCandidate(candidate: Omit<FrontierCandidate, 'priority'>): Promise<void> {
    const priority = this.calculatePriority(candidate);
    
    const frontierCandidate: FrontierCandidate = {
      ...candidate,
      priority
    };
    
    await DiscoveryRedis.addFrontierCandidate(this.groupId, frontierCandidate, priority);
    
    // Update cursor in database
    await this.updateCursor(candidate.source, candidate.cursor, candidate.duplicateHitRate);
  }
  
  /**
   * Get highest priority candidate
   */
  async getNextCandidate(): Promise<FrontierCandidate | null> {
    return await DiscoveryRedis.getFrontierCandidate(this.groupId);
  }
  
  /**
   * Remove candidate from frontier
   */
  async removeCandidate(candidate: FrontierCandidate): Promise<void> {
    await DiscoveryRedis.removeFrontierCandidate(this.groupId, candidate);
  }
  
  /**
   * Update candidate after processing
   */
  async updateCandidateAfterProcessing(
    candidate: FrontierCandidate, 
    wasSuccessful: boolean
  ): Promise<void> {
    const newDuplicateHitRate = wasSuccessful 
      ? Math.max(0, candidate.duplicateHitRate - 0.1) // Reduce penalty on success
      : Math.min(1, candidate.duplicateHitRate + 0.2); // Increase penalty on failure
    
    const updatedCandidate: FrontierCandidate = {
      ...candidate,
      duplicateHitRate: newDuplicateHitRate,
      lastHitAt: new Date()
    };
    
    // Remove old candidate
    await this.removeCandidate(candidate);
    
    // Add updated candidate
    await this.addCandidate(updatedCandidate);
  }
  
  /**
   * Calculate priority score for candidate
   */
  private calculatePriority(candidate: Omit<FrontierCandidate, 'priority'>): number {
    const now = Date.now();
    const lastHitMs = candidate.lastHitAt.getTime();
    const recencyDays = (now - lastHitMs) / (1000 * 60 * 60 * 24);
    
    // Novelty: prefer newer sources
    const novelty = 1 / (1 + recencyDays);
    
    // Diversity: prefer sources with lower hit rates
    const diversity = 1 - candidate.duplicateHitRate;
    
    // Penalty: backoff noisy sources
    const penalty = candidate.duplicateHitRate;
    
    // Combined priority: 60% novelty + 30% diversity - 10% penalty
    const priority = 0.6 * novelty + 0.3 * diversity - 0.1 * penalty;
    
    return Math.max(0, priority);
  }
  
  /**
   * Update cursor state in database
   */
  private async updateCursor(source: string, nextToken: string, duplicateHitRate: number): Promise<void> {
    await prisma.discoveryCursor.upsert({
      where: {
        patchId_source: {
          patchId: this.groupId,
          source: source
        }
      },
      update: {
        nextToken,
        duplicateHitRate,
        lastHitAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        patchId: this.groupId,
        source,
        nextToken,
        duplicateHitRate,
        lastHitAt: new Date()
      }
    });
  }
  
  /**
   * Get all cursors for group
   */
  async getCursors(): Promise<Array<{
    source: string;
    nextToken: string | null;
    lastHitAt: Date;
    duplicateHitRate: number;
    priority: number;
  }>> {
    const cursors = await prisma.discoveryCursor.findMany({
      where: { patchId: this.groupId },
      orderBy: { priority: 'desc' }
    });
    
    return cursors.map(cursor => ({
      source: cursor.source,
      nextToken: cursor.nextToken,
      lastHitAt: cursor.lastHitAt,
      duplicateHitRate: cursor.duplicateHitRate,
      priority: cursor.priority
    }));
  }
  
  /**
   * Initialize frontier with default sources
   */
  async initializeFrontier(patchHandle: string): Promise<void> {
    const defaultSources = this.getDefaultSources(patchHandle);
    
    for (const source of defaultSources) {
      await this.addCandidate({
        source: source.name,
        method: source.type,
        cursor: '',
        lastHitAt: new Date(),
        duplicateHitRate: 0
      });
    }
  }
  
  /**
   * Get default sources for a patch
   */
  private getDefaultSources(patchHandle: string): SearchProvider[] {
    const sources: SearchProvider[] = [];
    
    // RSS feeds for common domains
    if (patchHandle.includes('bulls') || patchHandle.includes('basketball')) {
      sources.push(
        { name: 'rss:nba.com/bulls', type: 'rss', baseUrl: 'https://www.nba.com/bulls/news', rateLimit: 60, priority: 1.0 },
        { name: 'rss:espn.com/bulls', type: 'rss', baseUrl: 'https://www.espn.com/nba/team/_/name/chi/chicago-bulls', rateLimit: 60, priority: 0.9 },
        { name: 'rss:bleacherreport.com/bulls', type: 'rss', baseUrl: 'https://bleacherreport.com/chicago-bulls', rateLimit: 60, priority: 0.8 }
      );
    }
    
    // YouTube channels
    sources.push(
      { name: 'yt:UC...', type: 'youtube', baseUrl: 'https://www.youtube.com', rateLimit: 100, priority: 0.7 }
    );
    
    // Reddit communities
    sources.push(
      { name: 'reddit:r/chicagobulls', type: 'reddit', baseUrl: 'https://www.reddit.com/r/chicagobulls', rateLimit: 60, priority: 0.6 }
    );
    
    // Web search
    sources.push(
      { name: 'web:bing:q=chicago+bulls', type: 'web', baseUrl: 'https://www.bing.com/search', rateLimit: 30, priority: 0.5 }
    );
    
    return sources;
  }
  
  /**
   * Get frontier statistics
   */
  async getFrontierStats(): Promise<{
    totalCandidates: number;
    averagePriority: number;
    topSources: Array<{ source: string; priority: number; duplicateRate: number }>;
  }> {
    const cursors = await this.getCursors();
    
    const totalCandidates = cursors.length;
    const averagePriority = cursors.reduce((sum, c) => sum + c.priority, 0) / totalCandidates;
    
    const topSources = cursors
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)
      .map(cursor => ({
        source: cursor.source,
        priority: cursor.priority,
        duplicateRate: cursor.duplicateHitRate
      }));
    
    return {
      totalCandidates,
      averagePriority,
      topSources
    };
  }
}
