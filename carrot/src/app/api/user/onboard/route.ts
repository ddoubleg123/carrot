import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { prisma } from '../../../../lib/prisma';

export async function POST(request: Request) {
  let session;
  let sessionId: string | undefined;
  
  try {
    session = await auth();
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the sessionId from the request body (optional)
    try {
      const body = await request.json();
      sessionId = body.sessionId;
    } catch {
      // Body parsing failed, continue without sessionId
    }

    console.log('[onboard API] Finalizing onboarding for user:', session.user.id, 'sessionId:', sessionId);

    // Prepare user data for Prisma update, filtering out undefined values
    const updateData: any = {
      isOnboarded: true,
      // Track TOS and Privacy Policy acceptance with current timestamp
      tosAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      // Version tracking for future policy updates
      tosVersion: '1.0',
      privacyVersion: '1.0',
    };

    // Only add fields that are not undefined
    if (session.user.username !== undefined) updateData.username = session.user.username;
    if (session.user.name !== undefined) updateData.name = session.user.name;
    if (session.user.profilePhoto !== undefined) updateData.profilePhoto = session.user.profilePhoto;

    console.log('[onboard API] Updating user data in Prisma:', updateData);

    // Update the user in Prisma database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        profilePhoto: true,
        isOnboarded: true
      }
    });

    console.log('[onboard API] Successfully updated onboarding status for user:', session.user.id);
    console.log('[onboard API] Updated user data:', updatedUser);
    
    return NextResponse.json({ 
      success: true,
      userId: updatedUser.id,
      isOnboarded: updatedUser.isOnboarded,
      profilePhoto: updatedUser.profilePhoto,
      username: updatedUser.username,
      name: updatedUser.name
    });
  } catch (error) {
    console.error('[onboard API] Error in onboarding API:', error);
    console.error('[onboard API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: session?.user?.id || 'unknown',
      sessionId: sessionId || 'unknown'
    });
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
