export const runtime = 'nodejs';

import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  const log = (...args: any[]) => console.log(`[${new Date().toISOString()}] [user/update]`, ...args);
  try {
    log('Request received');
    const session = await auth();
    log('Session:', JSON.stringify(session));
    if (!session?.user?.email) {
      log('Unauthorized: No session or email');
      return new Response("Unauthorized", { status: 401 });
    }

    const TEST_EMAILS = ["danielgouldman@yahoo.com", "daniel@ownrabbit.com"];
    const body = await req.json();
    log('Request body:', JSON.stringify(body));
    const { firstName, lastName, username, phone, country, postalCode, image, profilePhoto, interests } = body;
    // --- LOG PROFILE PHOTO DETAILS ---
    if (profilePhoto !== undefined) {
      log('[profilePhoto] type:', typeof profilePhoto, '| length:', profilePhoto?.length, '| sample:', typeof profilePhoto === 'string' ? profilePhoto.slice(0, 80) : '[not string]');
    } else {
      log('[profilePhoto] not present in request body');
    }

    if (TEST_EMAILS.includes(session.user.email)) {
      log('Test account, skipping update:', session.user.email);
      return new Response(null, { status: 204 });
    }

    // --- ENFORCE URL-ONLY FOR profilePhoto ---
    let safeProfilePhoto = profilePhoto;
    if (typeof profilePhoto === 'string') {
      if (profilePhoto.startsWith('data:')) {
        log('[REJECTED] profilePhoto is a data URL (base64); must upload and use a URL instead.');
        return new Response(JSON.stringify({ error: 'Profile photo must be a URL, not a base64 image. Please upload your photo and provide the resulting URL.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (profilePhoto && !/^https?:\/\//.test(profilePhoto)) {
        log('[REJECTED] profilePhoto is not a valid URL:', profilePhoto);
        return new Response(JSON.stringify({ error: 'Profile photo must be a valid URL (http/https).' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    // Sanitize interests input as plain text (strip HTML/script, trim, limit length)
    let safeInterests = undefined;
    if (typeof interests === 'string' && interests.trim().length > 0) {
      // Remove <script> tags and all HTML tags
      safeInterests = interests
        .replace(/<script.*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<.*?>/g, '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
        .trim()
        .slice(0, 255); // Limit to 255 chars
    }
    const updateData = {
      firstName,
      lastName,
      username,
      phone,
      country,
      postalCode,
      image,
      profilePhoto: safeProfilePhoto,
      isOnboarded: true,
      interests: safeInterests,
    };
    // Remove 'interests' from updateData if present (handled above)

    log('Prisma update input:', JSON.stringify({ where: { email: session.user.email }, data: updateData }));

    log('About to upsert user in DB with:', JSON.stringify(updateData));
    const result = await prisma.user.upsert({
      where: { email: session.user.email },
      create: {
        email: session.user.email,
        id: session.user.id || undefined,
        ...updateData
      },
      update: updateData,
    });
    log('Prisma update result:', JSON.stringify(result));
    // Fetch user again to verify DB value
    const verifyUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    log('DB user after update:', JSON.stringify(verifyUser));
    return new Response(null, { status: 204 });
  } catch (error: any) {
    const errMsg = error?.message || error;
    log('Error occurred:', errMsg);
    if (error?.stack) log('Error stack:', error.stack);
    if (error?.code) log('Error code:', error.code);
    if (error?.meta) log('Error meta:', JSON.stringify(error.meta));
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
