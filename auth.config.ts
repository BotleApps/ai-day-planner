import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe NextAuth configuration.
 *
 * This file MUST NOT import anything that depends on Node-only APIs
 * (e.g. `google-auth-library`, `pg`, Prisma). It is consumed by
 * `middleware.ts`, which runs on the Edge runtime. The Node-only
 * Credentials provider used for native Google Sign-In lives in `auth.ts`.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user, profile }) {
      // Web (OAuth) sign-in: Google profile is present.
      if (profile?.sub) {
        token.id = profile.sub;
      }
      // Native sign-in (Credentials provider): `user` carries the verified id.
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
};
