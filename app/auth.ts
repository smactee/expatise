// app/auth.ts
import NextAuth from "next-auth";
import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import WeChat from "next-auth/providers/wechat";

const providers: any[] = [];

// ✅ add providers only if env vars exist (prevents dev crashes)
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    })
  );
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.AUTH_WECHAT_APP_ID &&
  process.env.AUTH_WECHAT_APP_SECRET
) {
  providers.push(
    WeChat({
      clientId: process.env.AUTH_WECHAT_APP_ID,
      clientSecret: process.env.AUTH_WECHAT_APP_SECRET,
      platformType: "WebsiteApp",
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  trustHost: true,

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 300, // 300 days
  },

  callbacks: {
    async jwt({ token, account }: { token: JWT; account?: Account | null }) {
      if (account?.provider) (token as any).provider = account.provider;
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      (session as any).provider = (token as any).provider ?? null;
      return session;
    },
  },
});
