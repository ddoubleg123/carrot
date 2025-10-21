/**
 * NewsAPI integration for recent articles
 */

export interface NewsArticle {
  title: string
  description: string
  url: string
  urlToImage?: string
  publishedAt: string
  source: {
    id: string | null
    name: string
  }
  author?: string
  content?: string
}

export class NewsSource {
  private static readonly BASE_URL = 'https://newsapi.org/v2'
  private static readonly API_KEY = process.env.NEWS_API_KEY

  /**
   * Search for news articles
   */
  static async search(
    query: string,
    options: {
      fromDate?: string // ISO date string
      toDate?: string
      language?: string
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt'
      pageSize?: number
    } = {}
  ): Promise<NewsArticle[]> {
    if (!this.API_KEY) {
      console.warn('[NewsAPI] API key not configured, skipping news search')
      return []
    }

    try {
      console.log(`[NewsAPI] Searching for: "${query}"`)

      const params = new URLSearchParams({
        q: query,
        language: options.language || 'en',
        sortBy: options.sortBy || 'relevancy',
        pageSize: (options.pageSize || 20).toString(),
        apiKey: this.API_KEY
      })

      if (options.fromDate) {
        params.append('from', options.fromDate)
      }

      if (options.toDate) {
        params.append('to', options.toDate)
      }

      const url = `${this.BASE_URL}/everything?${params.toString()}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CarrotApp/1.0'
        }
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`NewsAPI error: ${response.status}`)
      }

      const data = await response.json()

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI returned status: ${data.status}`)
      }

      const articles = data.articles || []
      
      console.log(`[NewsAPI] Found ${articles.length} articles for "${query}"`)

      return articles

    } catch (error: any) {
      console.error(`[NewsAPI] Search error for "${query}":`, error)
      return []
    }
  }

  /**
   * Search multiple keywords and combine results
   */
  static async searchMultiple(
    keywords: string[],
    options: {
      fromDate?: string
      maxPerKeyword?: number
    } = {}
  ): Promise<NewsArticle[]> {
    const allArticles: NewsArticle[] = []
    const seenUrls = new Set<string>()

    const fromDate = options.fromDate || this.getDateDaysAgo(30)

    for (const keyword of keywords) {
      const articles = await this.search(keyword, {
        fromDate,
        pageSize: options.maxPerKeyword || 10,
        sortBy: 'publishedAt'
      })

      // Deduplicate by URL
      for (const article of articles) {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url)
          allArticles.push(article)
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`[NewsAPI] Total unique articles: ${allArticles.length}`)

    return allArticles
  }

  /**
   * Get date N days ago in ISO format
   */
  private static getDateDaysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
  }
}
