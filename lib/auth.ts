import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findAuthorizedUser, recordSuccessfulLogin } from "./users";

type GoogleProfile = {
  email_verified?: boolean;
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/entrar",
    error: "/entrar",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email) return false;
      if ((profile as GoogleProfile | undefined)?.email_verified !== true) {
        return false;
      }

      const appUser = await findAuthorizedUser(user.email);
      if (!appUser) return false;

      await recordSuccessfulLogin({
        email: user.email,
        fullName: user.name,
        pictureUrl: user.image,
      });
      return true;
    },
    async jwt({ token }) {
      const appUser = await findAuthorizedUser(token.email);
      token.userId = appUser?.id ?? "";
      token.role = appUser?.role ?? null;
      token.active = Boolean(appUser);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId || "");
        session.user.role = token.role ?? null;
        session.user.active = token.active === true;
      }
      return session;
    },
  },
};

export async function getAuthenticatedSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.active ||
    !session.user.id ||
    !session.user.email ||
    !session.user.role
  ) {
    return null;
  }
  return session;
}
