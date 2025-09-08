import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { videoVariantsService } from '@/lib/variantsService';

export const runtime = 'nodejs';

export async function GET(req: Request, context: { params: Promise<{ variantId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { variantId } = await context.params;

    // Get variant with ownership check
    const variant = await videoVariantsService.getVariant(variantId);
    
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    // Check ownership
    if (variant.userVideo.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      variant
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Get variant error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ variantId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { variantId } = await context.params;

    // Get variant with ownership check
    const variant = await videoVariantsService.getVariant(variantId);
    
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    // Check ownership
    if (variant.userVideo.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete variant
    await videoVariantsService.deleteVariant(variantId);

    return NextResponse.json({
      success: true,
      message: 'Variant deleted successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Delete variant error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
