/**
 * Topic seeding for crawler
 * Phase 5: Topic Seeding
 * Generates high-signal seed URLs for a given topic
 */

import { enqueueDiscoveryUrl } from './queues'
import { calculatePriority } from './priority'
import { extractDomain } from './utils'
import { crawlerConfig } from './config'
import { CRAWLER_PRIORITY_V2 } from '../discovery/flags'

interface SeedOptions {
  topic: string
  highSignalDomains?: string[]
  maxSeeds?: number
}

/**
 * High-signal domains for sports/news topics
 */
const HIGH_SIGNAL_DOMAINS = [
  'espn.com',
  'theathletic.com',
  'nbcchicago.com',
  'nba.com',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'cnn.com',
]

/**
 * Generate seed URLs from high-signal hub queries
 * Creates Google News search URLs for topic + domain combinations
 */
export async function generateHubQuerySeeds(
  topic: string,
  domains: string[] = HIGH_SIGNAL_DOMAINS.slice(0, 5)
): Promise<string[]> {
  const seeds: string[] = []
  
  // Create Google News search URLs for each domain
  for (const domain of domains) {
    const query = encodeURIComponent(`${topic} site:${domain}`)
    const googleNewsUrl = `https://www.google.com/search?q=${query}&tbm=nws&hl=en`
    seeds.push(googleNewsUrl)
  }
  
  // Add generic Google News search
  const genericQuery = encodeURIComponent(topic)
  const genericUrl = `https://www.google.com/search?q=${genericQuery}&tbm=nws&hl=en`
  seeds.push(genericUrl)
  
  return seeds
}

/**
 * Generate curated seed list from known high-yield URLs
 */
export function generateCuratedSeeds(topic: string): string[] {
  // For "Chicago Bulls" example:
  const curated: Record<string, string[]> = {
    'chicago bulls': [
      'https://www.espn.com/nba/team/_/name/chi/chicago-bulls',
      'https://www.nba.com/bulls',
      'https://www.nbcchicago.com/topics/chicago-bulls/',
      'https://theathletic.com/nba/team/chicago-bulls/',
    ],
  }
  
  const normalizedTopic = topic.toLowerCase().trim()
  return curated[normalizedTopic] || []
}

/**
 * Seed discovery queue with initial URLs for a topic
 */
export async function seedDiscoveryQueue(options: SeedOptions): Promise<number> {
  const { topic, highSignalDomains, maxSeeds = 20 } = options
  
  let enqueuedCount = 0
  
  // 1. Generate hub query seeds
  const hubSeeds = await generateHubQuerySeeds(topic, highSignalDomains)
  
  for (const seedUrl of hubSeeds) {
    if (enqueuedCount >= maxSeeds) break
    
    const domain = extractDomain(seedUrl) || 'unknown'
    const priority = CRAWLER_PRIORITY_V2
      ? calculatePriority(seedUrl, {}, {
          isWikipedia: false,
          wikiCount: 0,
          isDuplicate: false,
          hasPriorFailure: false,
        }).score
      : 100 // High priority for seeds
    
    await enqueueDiscoveryUrl(seedUrl, priority, topic, {
      metadata: { seedType: 'hub_query' },
    })
    enqueuedCount++
  }
  
  // 2. Add curated seeds
  const curatedSeeds = generateCuratedSeeds(topic)
  for (const seedUrl of curatedSeeds) {
    if (enqueuedCount >= maxSeeds) break
    
    const domain = extractDomain(seedUrl) || 'unknown'
    const priority = CRAWLER_PRIORITY_V2
      ? calculatePriority(seedUrl, {}, {
          isWikipedia: false,
          wikiCount: 0,
          isDuplicate: false,
          hasPriorFailure: false,
        }).score
      : 120 // Even higher priority for curated seeds
    
    await enqueueDiscoveryUrl(seedUrl, priority, topic, {
      metadata: { seedType: 'curated' },
    })
    enqueuedCount++
  }
  
  return enqueuedCount
}

