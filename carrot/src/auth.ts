import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

import { patchAdapter } from "./adapterPatch";


// Helper to refresh Google tokens inside the JWT callback
async function refreshGoogleToken(token: JWT) {
  try {
    const refreshToken = token.refresh_token as string;
    if (!refreshToken) {
      console.warn('[NextAuth] No refresh_token present in JWT when attempting to refresh Google token.');
    } else {
      console.log('[NextAuth] Attempting Google token refresh with refresh_token:', refreshToken.slice(0, 4) + '...' + refreshToken.slice(-4));
    }
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };
    const body = new URLSearchParams(params);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    let refreshed: any = {};
    try {
      refreshed = await res.json();
    } catch (jsonErr) {
      const text = await res.text();
      console.error('[NextAuth] Google token refresh failed, non-JSON response:', text);
      throw text;
    }
    if (!res.ok) {
      console.error("[NextAuth] Google token refresh failed", {
        status: res.status,
        statusText: res.statusText,
        response: refreshed,
        sent: {
          ...params,
          client_secret: params.client_secret ? '***' : undefined
        }
      });
      throw refreshed;
    }

    return {
      ...token,
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    };
  } catch (err) {
    console.error("[NextAuth] Error refreshing access token", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

// --- SESSION BLOAT GUARDRAILS: HTTP 431 PREVENTION ---
// Only allow these fields in JWT/session. Anything else is stripped and triggers a warning.
const ALLOWED_FIELDS = ['id', 'email', 'username', 'profilePhoto', 'image', 'emailVerified', 'provider'];

function containsNestedObject(obj: any, depth = 0): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  if (depth > 2) return true;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return true;
    }
  }
  return false;
}

function logObjectSize(name: string, obj: any) {
  try {
    const str = JSON.stringify(obj);
    console.log(`[${name}] size:`, str.length, 'bytes');
    if (str.length > 3500) {
      console.warn(`[${name}] WARNING: Object exceeds 3.5KB, risk of session bloat!`);
    }
  } catch (e) {
    console.warn(`[${name}] Could not stringify object for size check.`);
  }
}

const adapter = patchAdapter(PrismaAdapter(prisma));

export const authOptions = {
  adapter,
  cookies: {
    sessionToken: {
      name: "next-auth.session-token.carrot",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  session: {
    strategy: 'jwt' as const,
  },
  debug: true,

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
    }),
  ],

  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  callbacks: {
    async jwt({ token, user, account }: { token: any; user: any; account: any }) {
      if (user) {
        if (account?.provider) {
          token.provider = account.provider;
        }
        token.id = user.id;
        token.email = user.email;
        token.username = user.username || undefined;
        token.profilePhoto = user.profilePhoto || undefined;
        token.image = user.image || undefined;
        if ('emailVerified' in user) {
          token.emailVerified = user.emailVerified;
        }
        console.log('[NextAuth][jwt callback] user fields:', Object.keys(user));
        if (typeof user.image === 'string' && user.image.startsWith('data:image')) {
          console.warn('[NextAuth][jwt callback] user.image contains base64 data!');
        }
        if (typeof user.profilePhoto === 'string' && user.profilePhoto.startsWith('data:image')) {
          console.warn('[NextAuth][jwt callback] user.profilePhoto contains base64 data!');
        }
      }
      const size = JSON.stringify(token).length;
      if (size > 1000) {
        console.warn(`[NextAuth][jwt callback] token size is large: ${size} bytes`, token);
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.user = {
        id: token.id as string,
        email: token.email as string,
        username: token.username as string | undefined,
        profilePhoto: token.profilePhoto as string | undefined,
        image: token.image as string | undefined,
        emailVerified: null as Date | null,

      };
      const size = JSON.stringify(session).length;
      if (size > 1000) {
        console.warn(`[NextAuth][session callback] session size is large: ${size} bytes`, session);
      }
      if (typeof token.image === 'string' && token.image.startsWith('data:image')) {
        console.warn('[NextAuth][session callback] token.image contains base64 data!');
      }
      if (typeof token.profilePhoto === 'string' && token.profilePhoto.startsWith('data:image')) {
        console.warn('[NextAuth][session callback] token.profilePhoto contains base64 data!');
      }
      return session;
    },
  }
};

import { getServerSession } from "next-auth";



export async function auth() {
  return getServerSession(authOptions);
}

export { signOut } from "next-auth/react";
