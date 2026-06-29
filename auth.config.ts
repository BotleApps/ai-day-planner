import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe NextAuth configuration.
 *
 * This file MUST NOT import anything that depends on Node-only APIs
 * (e.g. `google-auth-library`, `pg`, Prisma). It is consumed by
 * `middleware.ts`, which runs on the Edge runtime. The Node-only
 * Credentials provider used for native Google Sign-In lives in `auth.ts`.
 *
 * SECURITY NOTE — `trustHost: true`:
 * Required because the app sits behind Render's edge, which terminates TLS
 * and forwards via X-Forwarded-Host. NextAuth would otherwise reject those
 * requests. The host-header injection risk is mitigated because:
 *   1. NEXTAUTH_URL is set explicitly in production (Render injects
 *      RENDER_EXTERNAL_URL via render.yaml) and is what OAuth callback URLs
 *      are derived from.
 *   2. Google OAuth strict-mode rejects callbacks not in the registered
 *      redirect URI list.
 * If the reverse-proxy ever changes (e.g. self-hosted with raw nginx in front),
 * ensure X-Forwarded-Host is either stripped or set authoritatively by the proxy.
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
