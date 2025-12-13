import { prisma } from '../src/lib/prisma'

async function checkContentSource() {
  try {
    // Try to find content by slug or ID
    const slug = 'israeli-apartheid-cmixorwl'
    const possibleId = 'cmixorwl'
    
    // Search for content with this slug in metadata
    const content = await prisma.discoveredContent.findFirst({
      where: {
        OR: [
          { id: { contains: possibleId } },
          { 
            metadata: {
              path: ['urlSlug'],
              equals: slug
            }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        metadata: true
      }
    })
    
    if (!content) {
      console.log('Content not found. Searching for similar...')
      // Try searching by title
      const byTitle = await prisma.discoveredContent.findFirst({
        where: {
          title: {
            contains: 'Israeli apartheid',
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          canonicalUrl: true,
          metadata: true
        }
      })
      
      if (byTitle) {
        console.log('\n=== Found by title ===')
        console.log('ID:', byTitle.id)
        console.log('Title:', byTitle.title)
        console.log('sourceUrl:', byTitle.sourceUrl)
        console.log('canonicalUrl:', byTitle.canonicalUrl)
        console.log('metadata:', JSON.stringify(byTitle.metadata, null, 2))
        return
      }
      
      console.log('No content found')
      return
    }
    
    console.log('\n=== Content Found ===')
    console.log('ID:', content.id)
    console.log('Title:', content.title)
    console.log('sourceUrl:', content.sourceUrl)
    console.log('canonicalUrl:', content.canonicalUrl)
    console.log('\n=== Metadata ===')
    console.log(JSON.stringify(content.metadata, null, 2))
    
    // Extract domain from sourceUrl
    if (content.sourceUrl) {
      try {
        const url = new URL(content.sourceUrl)
        console.log('\n=== Extracted Domain ===')
        console.log('Domain:', url.hostname.replace('www.', ''))
      } catch (e) {
        console.log('\n=== Error parsing URL ===')
        console.log('URL:', content.sourceUrl)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkContentSource()

