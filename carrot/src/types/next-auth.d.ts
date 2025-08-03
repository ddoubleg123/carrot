import NextAuth, { DefaultSession, User as DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    profilePhoto?: string | null;
    isOnboarded?: boolean;
  }
  interface Session {
    user: {
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
      image?: string | null;
      profilePhoto?: string | null;
      email: string;
      name?: string | null;
      isOnboarded?: boolean;
    } & DefaultSession["user"];
  }
}
