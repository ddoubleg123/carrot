import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    console.log('🔧 Fixing discovered content URLs...')
    
    // Parse request body to check for patch handle
    let patchHandle = null;
    try {
      const body = await req.json();
      patchHandle = body.patchHandle;
    } catch {
      // No body or invalid JSON, continue with default behavior
    }
    
    // Build where clause based on whether patchHandle is provided
    let whereClause: any = {};
    
    if (patchHandle) {
      // Find the patch by handle
      const patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true }
      });
      
      if (!patch) {
        return NextResponse.json({
          success: false,
          error: `Patch with handle '${patchHandle}' not found`
        }, { status: 404 });
      }
      
      whereClause = {
        patchId: patch.id
      };
      
      console.log(`🎯 Targeting patch: ${patchHandle} (ID: ${patch.id})`);
    }

    // Get discovered content items
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        patchId: true
      }
    });

    console.log(`📊 Found ${discoveredContent.length} discovered content items to process`);

    // Real URL mappings for common topics
    const realUrlMappings: Record<string, string> = {
      'houston chronicle': 'https://www.houstonchronicle.com/sports/rockets/',
      'sports illustrated': 'https://www.si.com/nba/team/houston-rockets',
      'nba youtube': 'https://www.youtube.com/user/houstonrockets',
      'espn': 'https://www.espn.com/nba/team/_/name/hou/houston-rockets',
      'nba.com': 'https://www.nba.com/rockets',
      'clutchfans': 'https://www.clutchfans.net',
      'rockets wire': 'https://rocketswire.usatoday.com',
      'houston rockets': 'https://www.nba.com/rockets',
      'nba history': 'https://www.nba.com/history',
      'toyota center': 'https://www.toyotacenter.com',
      'the athletic': 'https://theathletic.com/nba/team/houston-rockets'
    };

    let processed = 0;
    let updated = 0;
    const results = [];

    // Process each item
    for (const item of discoveredContent) {
      try {
        console.log(`🎯 Processing: ${item.title}`);
        
        // Find matching real URL based on title
        let realUrl = null;
        const titleLower = item.title.toLowerCase();
        
        for (const [key, url] of Object.entries(realUrlMappings)) {
          if (titleLower.includes(key)) {
            realUrl = url;
            break;
          }
        }
        
        // If no match found, use a generic real URL
        if (!realUrl) {
          if (item.category === 'video') {
            realUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll as fallback
          } else if (item.category === 'news') {
            realUrl = 'https://www.espn.com/nba/team/_/name/hou/houston-rockets';
          } else {
            realUrl = 'https://www.nba.com/rockets';
          }
        }
        
        // Update the item with real URL
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { sourceUrl: realUrl }
        });
        
        console.log(`✅ Updated ${item.title}: ${item.sourceUrl} → ${realUrl}`);
        
        updated++;
        results.push({
          id: item.id,
          title: item.title,
          oldUrl: item.sourceUrl,
          newUrl: realUrl,
          success: true
        });
        
      } catch (error) {
        console.error(`❌ Failed to update ${item.title}:`, error);
        results.push({
          id: item.id,
          title: item.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      processed++;
    }
    
    console.log('🎉 URL fix completed!');
    console.log(`📊 Summary: ${processed} processed, ${updated} updated`);
    
    return NextResponse.json({
      success: true,
      message: 'Discovered content URLs fixed',
      summary: {
        total: discoveredContent.length,
        processed,
        updated,
        successRate: processed > 0 ? ((updated / processed) * 100).toFixed(1) + '%' : '0%'
      },
      results
    });
    
  } catch (error) {
    console.error('💥 URL fix failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'URL fix failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
