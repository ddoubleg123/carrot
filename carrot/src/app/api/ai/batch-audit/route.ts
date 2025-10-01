import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BatchAuditRequest {
  patchId: string;
  limit?: number;
}

export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { patchId, limit = 5 }: BatchAuditRequest = await req.json();

    if (!patchId) {
      return NextResponse.json({ error: 'Patch ID is required' }, { status: 400 });
    }

    // Find the patch
    const patch = await prisma.patch.findUnique({
      where: { id: patchId },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true
      }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Get pending content to audit
    const pendingContent = await prisma.discoveredContent.findMany({
      where: {
        patchId,
        status: 'pending'
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'asc' }
      ],
      take: limit
    });

    if (pendingContent.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending content to audit',
        auditedCount: 0
      });
    }

    // Audit each piece of content
    const auditResults = [];
    for (const content of pendingContent) {
      try {
        const auditResponse = await fetch(`${new URL(req.url).origin}/api/ai/audit-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contentId: content.id,
            patchName: patch.name,
            patchDescription: patch.description,
            patchTags: patch.tags,
            patchCategories: [] // We don't store categories in the patch model yet
          }),
        });

        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          auditResults.push({
            contentId: content.id,
            success: true,
            result: auditData.auditResult,
            updatedContent: auditData.updatedContent
          });
        } else {
          auditResults.push({
            contentId: content.id,
            success: false,
            error: 'Audit API failed'
          });
        }
      } catch (error) {
        console.error(`Failed to audit content ${content.id}:`, error);
        auditResults.push({
          contentId: content.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = auditResults.filter(r => r.success).length;
    const failedCount = auditResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      patchId,
      auditedCount: successCount,
      failedCount,
      totalProcessed: auditResults.length,
      results: auditResults
    });

  } catch (error) {
    console.error('Error in batch audit:', error);
    return NextResponse.json(
      { error: 'Failed to perform batch audit' },
      { status: 500 }
    );
  }
}
