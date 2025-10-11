interface GenerateCoverInput {
  domain: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  title?: string
}

/**
 * Generate a programmatic cover image (SVG-based, no letters)
 * Returns data:image/svg+xml URL
 */
export async function generateProgrammaticCover(input: GenerateCoverInput): Promise<string> {
  const { domain, type, title } = input
  
  // Get domain favicon or use a default icon
  const faviconUrl = await getFaviconUrl(domain)
  
  // Choose type-specific icon and colors
  const typeConfig = getTypeConfig(type)
  
  // Generate SVG
  const svg = generateSVGCover({
    domain,
    type,
    faviconUrl,
    ...typeConfig
  })
  
  // Convert to data URL
  const encodedSvg = encodeURIComponent(svg)
  return `data:image/svg+xml,${encodedSvg}`
}

/**
 * Get favicon URL for domain
 */
async function getFaviconUrl(domain: string): Promise<string | null> {
  try {
    const faviconUrls = [
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://www.${domain}/favicon.ico`,
      `https://www.${domain}/favicon.png`,
    ]
    
    for (const url of faviconUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD', timeout: 3000 })
        if (response.ok) return url
      } catch {
        continue
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Get type-specific configuration
 */
function getTypeConfig(type: string) {
  const configs = {
    article: {
      icon: '📄',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      accent: '#667eea'
    },
    video: {
      icon: '🎥',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      accent: '#f5576c'
    },
    pdf: {
      icon: '📋',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      accent: '#4facfe'
    },
    image: {
      icon: '🖼️',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      accent: '#43e97b'
    },
    text: {
      icon: '📝',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      accent: '#fa709a'
    }
  }
  
  return configs[type as keyof typeof configs] || configs.article
}

/**
 * Generate SVG cover
 */
function generateSVGCover({
  domain,
  type,
  faviconUrl,
  icon,
  gradient,
  accent
}: {
  domain: string
  type: string
  faviconUrl: string | null
  icon: string
  gradient: string
  accent: string
}): string {
  const width = 1280
  const height = 720
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/>
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#dots)"/>
      
      <!-- Subtle overlay pattern -->
      <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" opacity="0.8"/>
      
      <!-- Type icon (large, subtle) -->
      <text x="640" y="360" text-anchor="middle" font-size="120" fill="white" opacity="0.15" font-family="system-ui">
        ${icon}
      </text>
      
      <!-- Domain chip (bottom left) -->
      <rect x="40" y="620" width="200" height="60" rx="30" fill="white" opacity="0.9"/>
      <text x="140" y="655" text-anchor="middle" font-size="16" fill="#333" font-family="system-ui" font-weight="500">
        ${domain.replace('www.', '')}
      </text>
      
      <!-- Type badge (top right) -->
      <rect x="1040" y="40" width="120" height="40" rx="20" fill="${accent}" opacity="0.9"/>
      <text x="1100" y="65" text-anchor="middle" font-size="14" fill="white" font-family="system-ui" font-weight="600" text-transform="uppercase">
        ${type}
      </text>
      
      <!-- Subtle geometric elements -->
      <circle cx="200" cy="200" r="80" fill="white" opacity="0.05"/>
      <circle cx="1080" cy="520" r="120" fill="white" opacity="0.03"/>
      <rect x="1000" y="600" width="200" height="200" transform="rotate(45 1100 700)" fill="white" opacity="0.02"/>
    </svg>
  `.trim()
}
