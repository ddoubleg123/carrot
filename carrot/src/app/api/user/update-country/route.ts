import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { country } = await request.json();
    
    if (!country) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }

    // Update user's country
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { country: country },
      select: {
        id: true,
        email: true,
        username: true,
        country: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      user: updatedUser,
      message: 'Country updated successfully' 
    });
  } catch (error) {
    console.error('Error updating user country:', error);
    return NextResponse.json({ error: 'Failed to update country' }, { status: 500 });
  }
}
