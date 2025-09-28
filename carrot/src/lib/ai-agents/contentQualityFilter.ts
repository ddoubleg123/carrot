/**
 * Content Quality Filter for AI Agent Training
 * Filters out irrelevant, low-quality, or inappropriate content
 */

export interface ContentQualityResult {
  isRelevant: boolean;
  qualityScore: number; // 0-1 scale
  issues: string[];
  recommendations: string[];
}

export interface ContentMetadata {
  title?: string;
  content: string;
  sourceUrl?: string;
  sourceType: string;
  author?: string;
  domain?: string;
  tags?: string[];
}

export class ContentQualityFilter {
  // Keywords that indicate irrelevant content
  private static readonly IRRELEVANT_KEYWORDS = [
    'advertisement', 'ad', 'promo', 'sponsor', 'buy now', 'click here',
    'subscribe', 'newsletter', 'marketing', 'sales', 'discount', 'offer',
    'casino', 'gambling', 'lottery', 'bet', 'poker', 'slots',
    'dating', 'hookup', 'escort', 'adult', 'xxx', 'porn',
    'viagra', 'pharmacy', 'medication', 'prescription',
    'crypto', 'bitcoin', 'investment', 'trading', 'forex',
    'weight loss', 'diet pill', 'supplement', 'miracle cure'
  ];

  // Keywords that indicate high-quality academic/professional content
  private static readonly QUALITY_INDICATORS = [
    'research', 'study', 'analysis', 'journal', 'academic', 'university',
    'peer-reviewed', 'published', 'scientific', 'empirical', 'evidence',
    'methodology', 'findings', 'conclusion', 'hypothesis', 'theory',
    'expert', 'professor', 'doctor', 'phd', 'scholar', 'researcher'
  ];

  // Domain patterns that are typically high-quality
  private static readonly QUALITY_DOMAINS = [
    'edu', 'gov', 'org', 'ac.uk', 'edu.au', 'ac.jp',
    'nature.com', 'science.org', 'jstor.org', 'arxiv.org',
    'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com'
  ];

  // Domain patterns that are typically low-quality
  private static readonly LOW_QUALITY_DOMAINS = [
    'blogspot.com', 'wordpress.com', 'tumblr.com', 'medium.com',
    'quora.com', 'reddit.com', 'facebook.com', 'twitter.com',
    'instagram.com', 'tiktok.com', 'youtube.com'
  ];

  /**
   * Filter content based on quality and relevance
   */
  static async filterContent(
    content: ContentMetadata,
    agentExpertise: string[]
  ): Promise<ContentQualityResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let qualityScore = 1.0;

    // Check for irrelevant keywords
    const contentText = `${content.title || ''} ${content.content}`.toLowerCase();
    const irrelevantMatches = this.IRRELEVANT_KEYWORDS.filter(keyword => 
      contentText.includes(keyword.toLowerCase())
    );

    if (irrelevantMatches.length > 0) {
      issues.push(`Contains irrelevant content: ${irrelevantMatches.join(', ')}`);
      qualityScore -= 0.5;
    }

    // Check domain quality
    if (content.sourceUrl) {
      const domain = this.extractDomain(content.sourceUrl);
      if (this.LOW_QUALITY_DOMAINS.some(lowDomain => domain.includes(lowDomain))) {
        issues.push(`Low-quality source domain: ${domain}`);
        qualityScore -= 0.3;
      } else if (this.QUALITY_DOMAINS.some(qualityDomain => domain.includes(qualityDomain))) {
        recommendations.push(`High-quality source: ${domain}`);
        qualityScore += 0.2;
      }
    }

    // Check for quality indicators
    const qualityMatches = this.QUALITY_INDICATORS.filter(indicator =>
      contentText.includes(indicator.toLowerCase())
    );

    if (qualityMatches.length > 0) {
      recommendations.push(`Contains quality indicators: ${qualityMatches.slice(0, 3).join(', ')}`);
      qualityScore += 0.1 * Math.min(qualityMatches.length, 3);
    }

    // Check relevance to agent expertise
    const relevanceScore = this.calculateRelevanceScore(content, agentExpertise);
    if (relevanceScore < 0.3) {
      issues.push(`Low relevance to agent expertise: ${agentExpertise.join(', ')}`);
      qualityScore -= 0.4;
    } else if (relevanceScore > 0.7) {
      recommendations.push(`Highly relevant to agent expertise`);
      qualityScore += 0.2;
    }

    // Check content length and structure
    if (content.content.length < 100) {
      issues.push('Content too short (less than 100 characters)');
      qualityScore -= 0.2;
    } else if (content.content.length > 10000) {
      issues.push('Content very long (may be too verbose)');
      qualityScore -= 0.1;
    }

    // Check for proper structure
    if (!content.title && content.content.length > 500) {
      issues.push('Long content without title');
      qualityScore -= 0.1;
    }

    // Ensure quality score is between 0 and 1
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    const isRelevant = qualityScore >= 0.5 && issues.length <= 2;

    return {
      isRelevant,
      qualityScore,
      issues,
      recommendations
    };
  }

  /**
   * Calculate relevance score based on agent expertise
   */
  private static calculateRelevanceScore(
    content: ContentMetadata,
    agentExpertise: string[]
  ): number {
    const contentText = `${content.title || ''} ${content.content}`.toLowerCase();
    const expertiseText = agentExpertise.join(' ').toLowerCase();
    
    // Simple keyword matching
    const expertiseKeywords = agentExpertise.map(exp => exp.toLowerCase());
    const matches = expertiseKeywords.filter(keyword => 
      contentText.includes(keyword)
    );

    return matches.length / expertiseKeywords.length;
  }

  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Batch filter multiple content items
   */
  static async filterBatch(
    contentItems: ContentMetadata[],
    agentExpertise: string[]
  ): Promise<{
    relevant: ContentMetadata[];
    filtered: ContentMetadata[];
    results: ContentQualityResult[];
  }> {
    const results: ContentQualityResult[] = [];
    const relevant: ContentMetadata[] = [];
    const filtered: ContentMetadata[] = [];

    for (const content of contentItems) {
      const result = await this.filterContent(content, agentExpertise);
      results.push(result);

      if (result.isRelevant) {
        relevant.push(content);
      } else {
        filtered.push(content);
      }
    }

    return { relevant, filtered, results };
  }

  /**
   * Get quality report for content
   */
  static generateQualityReport(results: ContentQualityResult[]): {
    totalItems: number;
    relevantItems: number;
    averageQuality: number;
    commonIssues: string[];
    topRecommendations: string[];
  } {
    const totalItems = results.length;
    const relevantItems = results.filter(r => r.isRelevant).length;
    const averageQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / totalItems;

    // Count common issues
    const issueCounts: { [key: string]: number } = {};
    results.forEach(result => {
      result.issues.forEach(issue => {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      });
    });

    const commonIssues = Object.entries(issueCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);

    // Count recommendations
    const recCounts: { [key: string]: number } = {};
    results.forEach(result => {
      result.recommendations.forEach(rec => {
        recCounts[rec] = (recCounts[rec] || 0) + 1;
      });
    });

    const topRecommendations = Object.entries(recCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([rec]) => rec);

    return {
      totalItems,
      relevantItems,
      averageQuality,
      commonIssues,
      topRecommendations
    };
  }
}
