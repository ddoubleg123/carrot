import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import prisma from "@/lib/prisma";

/**
 * Update hero image for discovered content
 * POST /api/internal/update-hero-image
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, hero, source = 'ai-generated' } = body;

    if (!id || !hero) {
      return NextResponse.json(
        { error: "Missing id or hero URL" },
        { status: 400 }
      );
    }

    console.log(`[update-hero-image] Updating hero for ${id}`);

    // Update in Prisma (primary database)
    try {
      const currentItem = await prisma.discoveredContent.findUnique({
        where: { id },
        select: { mediaAssets: true }
      });

      const currentMediaAssets = (currentItem?.mediaAssets as any) || {};

      await prisma.discoveredContent.update({
        where: { id },
        data: {
          mediaAssets: {
            ...currentMediaAssets,
            hero: hero,  // ← Correct field name per schema!
            source: source,
            license: source.includes('generated') ? 'generated' : 'source',
            updatedAt: new Date().toISOString()
          }
        }
      });

      console.log(`[update-hero-image] ✅ Updated hero in Prisma for ${id}`);
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
        const ref = doc(db, "discovered_content", id);
        await updateDoc(ref, { hero, heroSource: source, updatedAt: new Date().toISOString() });
        console.log(`[update-hero-image] ✅ Updated hero in Firebase for ${id}`);
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
