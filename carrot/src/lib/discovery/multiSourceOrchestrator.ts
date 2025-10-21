import { SearchCoordinator, type SearchStrategy } from './searchCoordinator'
import { WikipediaSource, type WikipediaPage, type WikipediaCitation } from './wikipediaSource'
import { NewsSource, type NewsArticle } from './newsSource'
import { canonicalize } from './canonicalization'

export interface DiscoveredSource {
  title: string
  url: string
  type: 'article' | 'news' | 'wikipedia' | 'citation'
  description: string
  content?: string
  source: string // e.g., "Wikipedia", "NewsAPI", "Wikipedia Citation"
  metadata: {
    author?: string
    publishedAt?: string
    sourceDomain?: string
    parentWikipediaPage?: string // For citations
    citationIndex?: number
  }
  relevanceScore: number
}

export interface DiscoveryResult {
  sources: DiscoveredSource[]
  strategy: SearchStrategy
  stats: {
    wikipediaPages: number
    wikipediaCitations: number
    newsArticles: number
    totalSources: number
    duplicatesRemoved: number
  }
}

/**
 * Multi-Source Discovery Orchestrator
 * Coordinates search across Wikipedia, NewsAPI, and other sources
 */
export class MultiSourceOrchestrator {
  private seenUrls = new Set<string>()
  private duplicateCount = 0

  /**
   * Execute full multi-source discovery
   */
  async discover(
    topicName: string,
    description: string,
    tags: string[]
  ): Promise<DiscoveryResult> {
    console.log('[MultiSourceOrchestrator] Starting discovery for:', topicName)

    // Step 1: Generate search strategy using DeepSeek
    const strategy = await SearchCoordinator.generateStrategy(topicName, description, tags)

    console.log('[MultiSourceOrchestrator] Strategy:', {
      wikipediaQueries: strategy.wikipediaQueries.length,
      newsKeywords: strategy.newsKeywords.length,
      sources: strategy.primarySources,
      depth: strategy.searchDepth
    })

    const allSources: DiscoveredSource[] = []
    let wikipediaPageCount = 0
    let wikipediaCitationCount = 0
    let newsArticleCount = 0

    // Step 2: Search Wikipedia and extract citations
    if (strategy.primarySources.includes('Wikipedia') && strategy.wikipediaQueries.length > 0) {
      const wikipediaSources = await this.searchWikipedia(strategy)
      wikipediaPageCount = wikipediaSources.filter(s => s.type === 'wikipedia').length
      wikipediaCitationCount = wikipediaSources.filter(s => s.type === 'citation').length
      allSources.push(...wikipediaSources)
    }

    // Step 3: Search NewsAPI
    if (strategy.primarySources.includes('NewsAPI') && strategy.newsKeywords.length > 0) {
      const newsSources = await this.searchNews(strategy)
      newsArticleCount = newsSources.length
      allSources.push(...newsSources)
    }

    // Step 4: TODO: Add other sources (arXiv, PubMed, etc.)

    console.log('[MultiSourceOrchestrator] ✅ Discovery complete:', {
      totalSources: allSources.length,
      wikipediaPages: wikipediaPageCount,
      citations: wikipediaCitationCount,
      news: newsArticleCount,
      duplicates: this.duplicateCount
    })

    return {
      sources: allSources,
      strategy,
      stats: {
        wikipediaPages: wikipediaPageCount,
        wikipediaCitations: wikipediaCitationCount,
        newsArticles: newsArticleCount,
        totalSources: allSources.length,
        duplicatesRemoved: this.duplicateCount
      }
    }
  }

  /**
   * Search Wikipedia and extract citations
   */
  private async searchWikipedia(strategy: SearchStrategy): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = []

    // Determine how many queries to use based on search depth
    const maxQueries = strategy.searchDepth === 'shallow' ? 3 
                      : strategy.searchDepth === 'medium' ? 7 
                      : 10

    const queries = strategy.wikipediaQueries.slice(0, maxQueries)

    for (const query of queries) {
      try {
        // Search for matching page titles
        const titles = await WikipediaSource.search(query, 1) // Get top result
        
        if (titles.length === 0) {
          console.log(`[Wikipedia] No results for "${query}"`)
          continue
        }

        const title = titles[0]

        // Fetch the full page with citations
        const page = await WikipediaSource.getPage(title)
        
        if (!page) continue

        // Check if we've seen this URL
        const canonicalResult = await canonicalize(page.url)
        if (this.seenUrls.has(canonicalResult.canonicalUrl)) {
          this.duplicateCount++
          continue
        }
        this.seenUrls.add(canonicalResult.canonicalUrl)

        // Add the Wikipedia page itself as a source
        sources.push({
          title: page.title,
          url: page.url,
          type: 'wikipedia',
          description: page.summary,
          content: page.content,
          source: 'Wikipedia',
          metadata: {
            sourceDomain: 'wikipedia.org'
          },
          relevanceScore: 95 // Wikipedia pages are highly authoritative
        })

        // Add all citations from this page
        for (const citation of page.citations) {
          if (!citation.url) continue

          // Skip relative URLs and Wikipedia internal links
          if (citation.url.startsWith('./') || 
              citation.url.startsWith('../') || 
              citation.url.startsWith('/') ||
              citation.url.includes('wikipedia.org') ||
              citation.url.startsWith('#')) {
            continue
          }

          // Canonicalize citation URL
          const citationCanonical = await canonicalize(citation.url)
          
          if (this.seenUrls.has(citationCanonical.canonicalUrl)) {
            this.duplicateCount++
            continue
          }
          this.seenUrls.add(citationCanonical.canonicalUrl)

          sources.push({
            title: citation.title || citation.text.substring(0, 100),
            url: citation.url,
            type: 'citation',
            description: citation.text,
            source: 'Wikipedia Citation',
            metadata: {
              author: citation.author,
              publishedAt: citation.date,
              sourceDomain: new URL(citation.url).hostname,
              parentWikipediaPage: page.title,
              citationIndex: citation.index
            },
            relevanceScore: 85 // Citations from Wikipedia are high quality
          })
        }

      } catch (error: any) {
        console.error(`[Wikipedia] Error processing query "${query}":`, error)
      }
    }

    return sources
  }

  /**
   * Search NewsAPI
   */
  private async searchNews(strategy: SearchStrategy): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = []

    try {
      // Determine max articles per keyword based on depth
      const maxPerKeyword = strategy.searchDepth === 'shallow' ? 5 
                           : strategy.searchDepth === 'medium' ? 10 
                           : 20

      const articles = await NewsSource.searchMultiple(strategy.newsKeywords, {
        maxPerKeyword
      })

      for (const article of articles) {
        // Canonicalize URL
        const canonicalResult = await canonicalize(article.url)
        
        if (this.seenUrls.has(canonicalResult.canonicalUrl)) {
          this.duplicateCount++
          continue
        }
        this.seenUrls.add(canonicalResult.canonicalUrl)

        sources.push({
          title: article.title,
          url: article.url,
          type: 'news',
          description: article.description || '',
          content: article.content,
          source: 'NewsAPI',
          metadata: {
            author: article.author,
            publishedAt: article.publishedAt,
            sourceDomain: new URL(article.url).hostname
          },
          relevanceScore: 80 // News articles are relevant but may be time-sensitive
        })
      }

    } catch (error: any) {
      console.error('[NewsAPI] Error:', error)
    }

    return sources
  }
}
