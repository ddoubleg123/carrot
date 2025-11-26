/**
 * Static seed URLs for Chicago Bulls and NBA
 * Vetted, paywall-free domains to ensure discovery never aborts
 */

export interface StaticSeed {
  url: string
  title: string
  category: 'official' | 'media' | 'data' | 'wikipedia'
  domain: string
}

/**
 * Get static Bulls seeds (10+ vetted NBA/Bulls domains)
 */
export function getStaticBullsSeeds(): StaticSeed[] {
  return [
    // Official sources
    {
      url: 'https://www.nba.com/bulls',
      title: 'Chicago Bulls Official Site',
      category: 'official',
      domain: 'nba.com'
    },
    {
      url: 'https://www.nba.com/bulls/news',
      title: 'Chicago Bulls News',
      category: 'official',
      domain: 'nba.com'
    },
    
    // Basketball Reference (data)
    {
      url: 'https://www.basketball-reference.com/teams/CHI/',
      title: 'Chicago Bulls Stats',
      category: 'data',
      domain: 'basketball-reference.com'
    },
    {
      url: 'https://www.basketball-reference.com/teams/CHI/2024.html',
      title: 'Chicago Bulls 2023-24 Season',
      category: 'data',
      domain: 'basketball-reference.com'
    },
    
    // ESPN
    {
      url: 'https://www.espn.com/nba/team/_/name/chi/chicago-bulls',
      title: 'Chicago Bulls - ESPN',
      category: 'media',
      domain: 'espn.com'
    },
    
    // NBA.com general
    {
      url: 'https://www.nba.com/news',
      title: 'NBA News',
      category: 'media',
      domain: 'nba.com'
    },
    
    // Wikipedia
    {
      url: 'https://en.wikipedia.org/wiki/Chicago_Bulls',
      title: 'Chicago Bulls - Wikipedia',
      category: 'wikipedia',
      domain: 'wikipedia.org'
    },
    {
      url: 'https://en.wikipedia.org/wiki/Michael_Jordan',
      title: 'Michael Jordan - Wikipedia',
      category: 'wikipedia',
      domain: 'wikipedia.org'
    },
    
    // The Athletic (usually accessible)
    {
      url: 'https://theathletic.com/nba/team/chicago-bulls/',
      title: 'Chicago Bulls - The Athletic',
      category: 'media',
      domain: 'theathletic.com'
    },
    
    // Bleacher Report
    {
      url: 'https://bleacherreport.com/chicago-bulls',
      title: 'Chicago Bulls - Bleacher Report',
      category: 'media',
      domain: 'bleacherreport.com'
    },
    
    // CBS Sports
    {
      url: 'https://www.cbssports.com/nba/teams/CHI/chicago-bulls/',
      title: 'Chicago Bulls - CBS Sports',
      category: 'media',
      domain: 'cbssports.com'
    },
    
    // Yahoo Sports
    {
      url: 'https://sports.yahoo.com/nba/teams/chicago-bulls/',
      title: 'Chicago Bulls - Yahoo Sports',
      category: 'media',
      domain: 'sports.yahoo.com'
    }
  ]
}

/**
 * Get unique domains from static seeds
 */
export function getStaticSeedDomains(): Set<string> {
  return new Set(getStaticBullsSeeds().map(s => s.domain))
}

