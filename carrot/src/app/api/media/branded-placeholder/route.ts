/**
 * Branded Placeholder API
 * Creates Chicago Bulls themed placeholder images
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { title, type = 'article' } = await request.json()
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    console.log(`[BrandedPlaceholder] Creating placeholder for: ${title}`)
    
    // Create Chicago Bulls themed placeholder
    const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=dc2626&color=ffffff&size=400&format=png&bold=true`
    
    return NextResponse.json({
      success: true,
      imageUrl: placeholderUrl,
      source: 'placeholder',
      license: 'generated'
    })
    
  } catch (error) {
    console.error('[BrandedPlaceholder] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create placeholder' },
      { status: 500 }
    )
  }
}
