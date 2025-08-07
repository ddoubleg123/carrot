import NextAuth, { DefaultSession, User as DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    profilePhoto?: string | null;
    isOnboarded?: boolean;
    emailVerified?: Date | null;
  }
  interface Session {
    user: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
      image?: string | null;
      profilePhoto?: string | null;
      email: string;
      name?: string | null;
      isOnboarded?: boolean;
      emailVerified?: Date | null;
    } & DefaultSession["user"];
  }
}
