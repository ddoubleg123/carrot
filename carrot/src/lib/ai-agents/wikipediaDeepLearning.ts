import { RetrievedContent } from './contentRetriever';
import { WikipediaReferenceExtractor, WikipediaPageWithReferences } from './wikipediaReferenceExtractor';
import { FeedService, FeedItem } from './feedService';

export interface WikipediaLearningResult {
  mainContent: RetrievedContent;
  references: RetrievedContent[];
  totalReferences: number;
  processedReferences: number;
  skippedReferences: number;
  learningStats: {
    highReliabilitySources: number;
    mediumReliabilitySources: number;
    lowReliabilitySources: number;
    academicSources: number;
    newsSources: number;
    bookSources: number;
  };
}

export class WikipediaDeepLearning {
  private static readonly MAX_REFERENCES_PER_PAGE = 20;
  private static readonly MIN_REFERENCE_CONTENT_LENGTH = 100;
  private static readonly REFERENCE_TIMEOUT = 10000; // 10 seconds per reference

  /**
   * Perform deep learning from a Wikipedia page including all references
   */
  static async learnFromWikipediaPage(
    pageTitle: string,
    agentId: string,
    options: {
      includeReferences?: boolean;
      maxReferences?: number;
      minReliability?: 'high' | 'medium' | 'low';
      referenceTypes?: string[];
    } = {}
  ): Promise<WikipediaLearningResult> {
    const {
      includeReferences = true,
      maxReferences = this.MAX_REFERENCES_PER_PAGE,
      minReliability = 'medium',
      referenceTypes = ['academic', 'journal', 'news', 'book']
    } = options;

    console.log(`[WikipediaDeepLearning] Starting deep learning for "${pageTitle}"`);

    try {
      // Extract Wikipedia page with references
      const pageData = await WikipediaReferenceExtractor.extractReferencesFromPage(pageTitle);
      
      // Create main content
      const mainContent: RetrievedContent = {
        title: pageData.title,
        url: pageData.url,
        content: pageData.content,
        sourceType: 'url',
        sourceTitle: pageData.title,
        sourceAuthor: 'Wikipedia',
        relevanceScore: 0.8
      };

      // Feed main content to agent
      const mainFeedItem: FeedItem = {
        content: pageData.content,
        sourceType: 'url',
        sourceUrl: pageData.url,
        sourceTitle: pageData.title,
        sourceAuthor: 'Wikipedia',
        tags: ['wikipedia', 'main-content', ...pageData.categories]
      };

      await FeedService.feedAgent(agentId, mainFeedItem, 'wikipedia-deep-learning');
      console.log(`[WikipediaDeepLearning] Fed main content to agent ${agentId}`);

      // Process references if requested
      let references: RetrievedContent[] = [];
      let processedReferences = 0;
      let skippedReferences = 0;
      const learningStats = {
        highReliabilitySources: 0,
        mediumReliabilitySources: 0,
        lowReliabilitySources: 0,
        academicSources: 0,
        newsSources: 0,
        bookSources: 0
      };

      if (includeReferences && pageData.references.length > 0) {
        console.log(`[WikipediaDeepLearning] Processing ${pageData.references.length} references`);
        
        // Filter references by criteria
        const filteredReferences = pageData.references.filter(ref => {
          // Check reliability threshold
          const reliabilityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          if (reliabilityOrder[ref.reliability] < reliabilityOrder[minReliability]) {
            return false;
          }
          
          // Check type filter
          if (referenceTypes.length > 0 && !referenceTypes.includes(ref.type)) {
            return false;
          }
          
          return true;
        });

        console.log(`[WikipediaDeepLearning] ${filteredReferences.length} references passed filters`);

        // Process references in batches to avoid overwhelming the system
        const batches = this.createBatches(filteredReferences.slice(0, maxReferences), 3);
        
        for (const batch of batches) {
          const batchPromises = batch.map(async (reference) => {
            try {
              console.log(`[WikipediaDeepLearning] Fetching reference: ${reference.title}`);
              
              const referenceContent = await this.fetchReferenceWithTimeout(reference);
              
              if (referenceContent && referenceContent.content.length >= this.MIN_REFERENCE_CONTENT_LENGTH) {
                // Update learning stats
                learningStats[`${reference.reliability}ReliabilitySources`]++;
                if (reference.type === 'academic' || reference.type === 'journal') {
                  learningStats.academicSources++;
                } else if (reference.type === 'news') {
                  learningStats.newsSources++;
                } else if (reference.type === 'book') {
                  learningStats.bookSources++;
                }

                // Feed reference content to agent
                const referenceFeedItem: FeedItem = {
                  content: referenceContent.content,
                  sourceType: 'url',
                  sourceUrl: reference.url,
                  sourceTitle: referenceContent.title,
                  sourceAuthor: referenceContent.sourceAuthor,
                  tags: [
                    'wikipedia-reference',
                    `reliability-${reference.reliability}`,
                    `type-${reference.type}`,
                    reference.domain,
                    ...pageData.categories
                  ]
                };

                await FeedService.feedAgent(agentId, referenceFeedItem, 'wikipedia-reference');
                console.log(`[WikipediaDeepLearning] Fed reference to agent: ${reference.title}`);
                
                return referenceContent;
              } else {
                console.log(`[WikipediaDeepLearning] Skipped reference (too short or failed): ${reference.title}`);
                return null;
              }
            } catch (error) {
              console.error(`[WikipediaDeepLearning] Error processing reference ${reference.title}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const validResults = batchResults.filter(result => result !== null);
          references.push(...validResults);
          processedReferences += validResults.length;
          skippedReferences += batchResults.length - validResults.length;

          // Small delay between batches
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      console.log(`[WikipediaDeepLearning] Deep learning complete for "${pageTitle}"`);
      console.log(`[WikipediaDeepLearning] Stats: ${processedReferences} processed, ${skippedReferences} skipped`);

      return {
        mainContent,
        references,
        totalReferences: pageData.references.length,
        processedReferences,
        skippedReferences,
        learningStats
      };

    } catch (error) {
      console.error(`[WikipediaDeepLearning] Error in deep learning for "${pageTitle}":`, error);
      throw error;
    }
  }

  /**
   * Fetch reference content with timeout
   */
  private static async fetchReferenceWithTimeout(reference: any): Promise<RetrievedContent | null> {
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Reference fetch timeout')), this.REFERENCE_TIMEOUT);
    });

    const fetchPromise = WikipediaReferenceExtractor.fetchReferenceContent(reference);

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.warn(`[WikipediaDeepLearning] Reference fetch failed: ${reference.title}`, error);
      return null;
    }
  }

  /**
   * Create batches from array
   */
  private static createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Learn from multiple Wikipedia pages
   */
  static async learnFromMultiplePages(
    pageTitles: string[],
    agentId: string,
    options: {
      includeReferences?: boolean;
      maxReferencesPerPage?: number;
      minReliability?: 'high' | 'medium' | 'low';
      referenceTypes?: string[];
    } = {}
  ): Promise<WikipediaLearningResult[]> {
    const results: WikipediaLearningResult[] = [];

    for (const pageTitle of pageTitles) {
      try {
        console.log(`[WikipediaDeepLearning] Processing page ${pageTitles.indexOf(pageTitle) + 1}/${pageTitles.length}: ${pageTitle}`);
        
        const result = await this.learnFromWikipediaPage(pageTitle, agentId, options);
        results.push(result);
        
        // Delay between pages to be respectful to Wikipedia
        if (pageTitles.indexOf(pageTitle) < pageTitles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`[WikipediaDeepLearning] Error processing page "${pageTitle}":`, error);
        // Continue with other pages even if one fails
      }
    }

    return results;
  }

  /**
   * Get learning statistics summary
   */
  static getLearningSummary(results: WikipediaLearningResult[]): {
    totalPages: number;
    totalReferences: number;
    processedReferences: number;
    skippedReferences: number;
    averageReferencesPerPage: number;
    sourceTypeBreakdown: Record<string, number>;
    reliabilityBreakdown: Record<string, number>;
  } {
    const summary = {
      totalPages: results.length,
      totalReferences: 0,
      processedReferences: 0,
      skippedReferences: 0,
      averageReferencesPerPage: 0,
      sourceTypeBreakdown: {
        academic: 0,
        journal: 0,
        news: 0,
        book: 0,
        website: 0
      },
      reliabilityBreakdown: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    for (const result of results) {
      summary.totalReferences += result.totalReferences;
      summary.processedReferences += result.processedReferences;
      summary.skippedReferences += result.skippedReferences;
      
      summary.sourceTypeBreakdown.academic += result.learningStats.academicSources;
      summary.sourceTypeBreakdown.news += result.learningStats.newsSources;
      summary.sourceTypeBreakdown.book += result.learningStats.bookSources;
      
      summary.reliabilityBreakdown.high += result.learningStats.highReliabilitySources;
      summary.reliabilityBreakdown.medium += result.learningStats.mediumReliabilitySources;
      summary.reliabilityBreakdown.low += result.learningStats.lowReliabilitySources;
    }

    summary.averageReferencesPerPage = summary.totalPages > 0 
      ? summary.totalReferences / summary.totalPages 
      : 0;

    return summary;
  }
}
