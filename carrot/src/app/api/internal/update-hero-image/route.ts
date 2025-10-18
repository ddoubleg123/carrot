import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Validation schema
const UpdateHeroSchema = z.object({
  itemId: z.string(),
  patchId: z.string().optional(),
  heroUrl: z.string().url(),
  source: z.enum(['og', 'oembed', 'inline', 'video', 'pdf', 'image', 'ai', 'generated']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

/**
 * Update hero image for discovered content
 * POST /api/internal/update-hero-image
 * 
 * INTERNAL USE ONLY - Requires x-internal-key header
 */
export async function POST(request: NextRequest) {
  try {
    // AUTH: Check for internal key (server-to-server only)
    const internalKey = request.headers.get('x-internal-key');
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      console.warn('[update-hero-image] Forbidden: Missing or invalid internal key');
      return NextResponse.json(
        { error: 'Forbidden: This endpoint is for internal use only' },
        { status: 403 }
      );
    }
    
    // VALIDATE: Parse and validate request body
    const body = await request.json();
    const validation = UpdateHeroSchema.safeParse(body);
    
    if (!validation.success) {
      console.warn('[update-hero-image] Bad Request:', validation.error.errors);
      return NextResponse.json(
        { 
          error: "Invalid request body", 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }
    
    const { itemId, heroUrl, source } = validation.data;

    console.log(`[update-hero-image] Updating hero for ${itemId}`);

    // Update in Prisma (primary database)
    try {
      const currentItem = await prisma.discoveredContent.findUnique({
        where: { id: itemId },
        select: { mediaAssets: true }
      });

      const currentMediaAssets = (currentItem?.mediaAssets as any) || {};

      await prisma.discoveredContent.update({
        where: { id: itemId },
        data: {
          mediaAssets: {
            ...currentMediaAssets,
            hero: heroUrl,
            source: source,
            license: source.includes('generated') ? 'generated' : 'source',
            updatedAt: new Date().toISOString()
          }
        }
      });

      console.log(`[update-hero-image] ✅ Updated hero in Prisma for ${itemId}`);
    } catch (prismaErr) {
      console.error(`[update-hero-image] Prisma update failed:`, prismaErr);
      return NextResponse.json(
        { error: "Failed to update database" },
        { status: 500 }
      );
    }

    // Optional: Also update in Firebase if available
    if (db) {
      try {
        const ref = doc(db, "discovered_content", itemId);
        await updateDoc(ref, { hero: heroUrl, heroSource: source, updatedAt: new Date().toISOString() });
        console.log(`[update-hero-image] ✅ Updated hero in Firebase for ${itemId}`);
      } catch (firebaseErr) {
        console.warn("[update-hero-image] Firebase update failed (non-critical):", firebaseErr);
        // Don't fail the request if Firebase fails - Prisma is primary
      }
    } else {
      console.warn("[update-hero-image] Firebase unavailable, skipping Firestore update.");
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[update-hero-image] ❌ Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update hero image" },
      { status: 500 }
    );
  }
}
