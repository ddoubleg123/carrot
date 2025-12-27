import { SearchCoordinator, type SearchStrategy } from './searchCoordinator'
import { WikipediaSource, type WikipediaPage, type WikipediaCitation } from './wikipediaSource'
import { NewsSource, type NewsArticle } from './newsSource'
import { searchAnnasArchive, annasArchiveToDiscoveredSource, type AnnasArchiveResult } from './annasArchiveSource'
import { canonicalize } from './canonicalization'
import { RelevanceEngine } from './relevance'

export interface DiscoveredSource {
  title: string
  url: string
  type: 'article' | 'news' | 'wikipedia' | 'citation' | 'book'
  description: string
  content?: string
  source: string // e.g., "Wikipedia", "NewsAPI", "Wikipedia Citation", "Anna's Archive"
  metadata: {
    author?: string
    publishedAt?: string
    sourceDomain?: string
    parentWikipediaPage?: string // For citations
    citationIndex?: number
    year?: number
    isbn?: string
    fileType?: string
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
    annasArchiveBooks: number
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
  private relevanceEngine = new RelevanceEngine()

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
    let annasArchiveBookCount = 0

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

    // Step 4: Search Anna's Archive (books, papers, documents)
    if (strategy.primarySources.includes('AnnasArchive') || strategy.primarySources.includes('Books')) {
      console.log('[MultiSourceOrchestrator] 🔍 Starting Anna\'s Archive search...')
      const annasArchiveSources = await this.searchAnnasArchive(strategy)
      annasArchiveBookCount = annasArchiveSources.length
      console.log(`[MultiSourceOrchestrator] ✅ Anna's Archive search complete: ${annasArchiveBookCount} sources found`)
      allSources.push(...annasArchiveSources)
    } else {
      console.log('[MultiSourceOrchestrator] ⚠️  Anna\'s Archive not in primarySources, skipping search')
    }

    // Step 5: TODO: Add other sources (arXiv, PubMed, etc.)

    // Step 6: Apply relevance filtering
    console.log('[MultiSourceOrchestrator] Applying relevance filtering...')
    const relevantSources = await this.filterRelevantSources(allSources, topicName)
    
    console.log('[MultiSourceOrchestrator] ✅ Discovery complete:', {
      totalSources: allSources.length,
      relevant: relevantSources.length,
      filtered: allSources.length - relevantSources.length,
      wikipediaPages: wikipediaPageCount,
      citations: wikipediaCitationCount,
      news: newsArticleCount,
      duplicates: this.duplicateCount
    })

    return {
      sources: relevantSources,
      strategy,
      stats: {
        wikipediaPages: wikipediaPageCount,
        wikipediaCitations: wikipediaCitationCount,
        newsArticles: newsArticleCount,
        annasArchiveBooks: annasArchiveBookCount,
        totalSources: relevantSources.length,
        duplicatesRemoved: this.duplicateCount
      }
    }
  }

  /**
   * Filter sources by relevance to the topic
   */
  private async filterRelevantSources(sources: DiscoveredSource[], topicName: string): Promise<DiscoveredSource[]> {
    console.log(`[MultiSourceOrchestrator] Filtering ${sources.length} sources for relevance to: ${topicName}`)
    
    // Build entity profile for the topic
    await this.relevanceEngine.buildEntityProfile('current-topic', topicName)
    
    const relevantSources: DiscoveredSource[] = []
    
    for (const source of sources) {
      try {
        const relevanceResult = await this.relevanceEngine.checkRelevance(
          'current-topic',
          source.title,
          source.content || source.description,
          source.metadata.sourceDomain || 'unknown'
        )
        
        if (relevanceResult.isRelevant) {
          // Update relevance score based on actual relevance check
          source.relevanceScore = Math.round(relevanceResult.score * 100)
          relevantSources.push(source)
          console.log(`[MultiSourceOrchestrator] ✅ Relevant: ${source.title} (score: ${source.relevanceScore})`)
        } else {
          console.log(`[MultiSourceOrchestrator] ❌ Filtered out: ${source.title} (${relevanceResult.reason})`)
        }
      } catch (error) {
        console.error(`[MultiSourceOrchestrator] Error checking relevance for ${source.title}:`, error)
        // Include source if relevance check fails (fail open)
        relevantSources.push(source)
      }
    }
    
    console.log(`[MultiSourceOrchestrator] Relevance filtering complete: ${relevantSources.length}/${sources.length} sources passed`)
    return relevantSources
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
      console.log(`[MultiSourceOrchestrator] Searching NewsAPI with ${strategy.newsKeywords.length} keywords:`, strategy.newsKeywords)
      
      // Determine max articles per keyword based on depth
      const maxPerKeyword = strategy.searchDepth === 'shallow' ? 5 
                           : strategy.searchDepth === 'medium' ? 10 
                           : 20

      console.log(`[MultiSourceOrchestrator] NewsAPI search depth: ${strategy.searchDepth}, max per keyword: ${maxPerKeyword}`)
      
      const articles = await NewsSource.searchMultiple(strategy.newsKeywords, {
        maxPerKeyword
      })

      console.log(`[MultiSourceOrchestrator] NewsAPI returned ${articles.length} articles`)

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

      console.log(`[MultiSourceOrchestrator] NewsAPI: Added ${sources.length} unique news sources (${this.duplicateCount} duplicates filtered)`)

    } catch (error: any) {
      console.error('[MultiSourceOrchestrator] NewsAPI Error:', error)
      console.error('[MultiSourceOrchestrator] NewsAPI Error details:', error?.message, error?.stack)
    }

    return sources
  }

  /**
   * Search Anna's Archive for books, papers, and documents
   */
  private async searchAnnasArchive(strategy: SearchStrategy): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = []

    try {
      // Determine how many results based on search depth
      const limit = strategy.searchDepth === 'shallow' ? 10 
                   : strategy.searchDepth === 'medium' ? 20 
                   : 30

      // Use Wikipedia queries as search terms (they're usually good keywords)
      const searchQueries = strategy.wikipediaQueries.slice(0, 3) // Use top 3 queries

      console.log(`[MultiSourceOrchestrator] Searching Anna's Archive with ${searchQueries.length} queries (limit: ${limit}):`, searchQueries)

      for (const query of searchQueries) {
        try {
          // Rate limiting: Add delay between queries to respect site limits
          if (searchQueries.indexOf(query) > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000)) // 3 second delay between queries
          }
          
          const perQueryLimit = Math.ceil(limit / searchQueries.length)
          console.log(`[MultiSourceOrchestrator] Searching Anna's Archive for: "${query}" (limit: ${perQueryLimit})`)
          const results = await searchAnnasArchive({
            query,
            language: 'en',
            fileType: 'all',
            limit: perQueryLimit
          })
          
          console.log(`[MultiSourceOrchestrator] ✅ Anna's Archive search for "${query}" returned ${results.length} results (requested: ${perQueryLimit})`)

          for (const result of results) {
            // Canonicalize URL
            const canonicalResult = await canonicalize(result.url)
            
            if (this.seenUrls.has(canonicalResult.canonicalUrl)) {
              this.duplicateCount++
              continue
            }
            this.seenUrls.add(canonicalResult.canonicalUrl)

            // Get preview if available
            let preview: string | null = null
            try {
              const { getAnnasArchivePreview } = await import('./annasArchiveSource')
              preview = await getAnnasArchivePreview(result)
            } catch (previewError) {
              // Preview is optional, continue without it
            }

            sources.push({
              title: result.title,
              url: result.url,
              type: 'book',
              description: preview || `${result.author ? `By ${result.author}. ` : ''}${result.year ? `Published ${result.year}. ` : ''}Available on Anna's Archive.`,
              content: preview || undefined,
              source: "Anna's Archive",
              metadata: {
                author: result.author,
                year: result.year,
                isbn: result.isbn,
                fileType: result.fileType,
                sourceDomain: 'annas-archive.org'
              },
              relevanceScore: 75 // Books are high quality but need relevance scoring
            })
          }
        } catch (error: any) {
          console.error(`[AnnasArchive] Error searching for "${query}":`, error)
        }
      }

    } catch (error: any) {
      console.error('[AnnasArchive] Search error:', error)
    }

    console.log(`[MultiSourceOrchestrator] Total Anna's Archive sources found: ${sources.length}`)
    return sources
  }
}
