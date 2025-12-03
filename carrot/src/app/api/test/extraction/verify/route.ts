/**
 * API route to manually trigger citation processing/verification
 * POST /api/test/extraction/verify
 * Body: { citationId: string }
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reprocessCitation } from '@/lib/discovery/wikipediaProcessor'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { citationId } = body

    if (!citationId) {
      return NextResponse.json(
        { error: 'citationId is required' },
        { status: 400 }
      )
    }

    // Verify citation exists
    const citation = await prisma.wikipediaCitation.findUnique({
      where: { id: citationId },
      include: {
        monitoring: {
          select: {
            patchId: true
          }
        }
      }
    })

    if (!citation) {
      return NextResponse.json(
        { error: 'Citation not found' },
        { status: 404 }
      )
    }

    // Reprocess the citation
    console.log(`[Manual Verification] Reprocessing citation: ${citationId}`)
    const result = await reprocessCitation(citationId)

    if (!result.processed) {
      return NextResponse.json(
        { error: 'Failed to process citation', details: result },
        { status: 500 }
      )
    }

    // Fetch updated citation
    const updatedCitation = await prisma.wikipediaCitation.findUnique({
      where: { id: citationId },
      include: {
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Citation processed successfully',
      citation: updatedCitation ? {
        id: updatedCitation.id,
        url: updatedCitation.citationUrl,
        scanStatus: updatedCitation.scanStatus,
        verificationStatus: updatedCitation.verificationStatus,
        relevanceDecision: updatedCitation.relevanceDecision,
        aiScore: updatedCitation.aiPriorityScore,
        contentLength: updatedCitation.contentText?.length || 0,
        savedContentId: updatedCitation.savedContentId,
        savedMemoryId: updatedCitation.savedMemoryId,
        errorMessage: updatedCitation.errorMessage,
        lastScannedAt: updatedCitation.lastScannedAt?.toISOString()
      } : null
    })
  } catch (error: any) {
    console.error('[Manual Verification] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to process citation',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

