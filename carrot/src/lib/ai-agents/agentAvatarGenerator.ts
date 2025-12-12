/**
 * Agent Avatar Generator
 * Generates unique avatar images for AI agents using Stable Diffusion
 */

import { generateAIImage } from '@/lib/media/aiImageGenerator'

export interface GenerateAgentAvatarRequest {
  patchTitle: string
  patchDescription?: string | null
  tags?: string[]
}

export interface AgentAvatarResult {
  success: boolean
  avatarUrl?: string
  error?: string
}

/**
 * Generate a unique avatar image for an AI agent based on patch information
 */
export async function generateAgentAvatar({
  patchTitle,
  patchDescription,
  tags = []
}: GenerateAgentAvatarRequest): Promise<AgentAvatarResult> {
  try {
    console.log('[AgentAvatarGenerator] Generating avatar for:', { patchTitle, tags })
    
    // Build a prompt specifically optimized for agent avatar/icon generation
    const avatarPrompt = buildAgentAvatarPrompt(patchTitle, patchDescription, tags)
    
    // Generate image with square dimensions suitable for avatar
    // Use illustration style for more icon-like appearance
    const result = await generateAIImage({
      title: patchTitle,
      summary: patchDescription || `AI agent specialized in ${patchTitle}`,
      customPrompt: avatarPrompt,
      artisticStyle: 'illustration', // More icon-like than photorealistic
      enableHiresFix: false, // Faster generation for avatars
      subjectFidelityPriority: false, // Less strict for abstract avatars
      preserveSubjectNames: false, // Not needed for abstract icons
      forceBothSubjects: false // Not needed for avatars
    })
    
    if (result.success && result.imageUrl) {
      console.log('[AgentAvatarGenerator] ✅ Successfully generated avatar')
      return {
        success: true,
        avatarUrl: result.imageUrl
      }
    }
    
    console.warn('[AgentAvatarGenerator] ⚠️ Image generation failed, no avatar URL returned')
    return {
      success: false,
      error: result.error || 'Failed to generate avatar image'
    }
    
  } catch (error) {
    console.error('[AgentAvatarGenerator] ❌ Error generating avatar:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating avatar'
    }
  }
}

/**
 * Build a prompt optimized for agent avatar/icon generation
 */
function buildAgentAvatarPrompt(
  title: string,
  description: string | null | undefined,
  tags: string[]
): string {
  const topic = title.toLowerCase()
  const tagContext = tags.slice(0, 3).join(', ') || ''
  
  // Extract key themes from description if available
  let themeContext = ''
  if (description) {
    const descLower = description.toLowerCase()
    // Extract key concepts (simple keyword extraction)
    const keyWords = descLower
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 3)
      .join(', ')
    if (keyWords) {
      themeContext = `Themes: ${keyWords}. `
    }
  }
  
  // Create a prompt optimized for avatar/icon generation
  // Focus on abstract representation, clean design, suitable for profile picture
  const prompt = `Professional AI agent avatar icon representing ${title}. 
${themeContext}${tagContext ? `Related topics: ${tagContext}. ` : ''}
Minimalist design, clean icon style, suitable for profile picture, 
square format, centered composition, modern digital art style, 
abstract representation of the topic, professional and approachable,
single subject focus, vibrant colors, high contrast, 
suitable for small display sizes, recognizable at thumbnail size,
no text, no words, pure visual symbol, geometric or organic shapes,
contemporary design aesthetic`

  return prompt.trim()
}

/**
 * Generate a fallback avatar using SVG (if AI generation fails)
 */
export function generateFallbackAvatar(title: string): string {
  // Create a simple SVG avatar based on title initials
  const initials = title
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
  
  // Generate a color based on title hash
  const hash = title.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  
  const hue = Math.abs(hash) % 360
  const saturation = 60 + (Math.abs(hash) % 20) // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15) // 45-60%
  
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="${color}" rx="128"/>
      <text x="256" y="320" font-family="Arial, sans-serif" font-size="180" font-weight="bold" 
            fill="white" text-anchor="middle" dominant-baseline="middle">
        ${initials}
      </text>
    </svg>
  `.trim()
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

