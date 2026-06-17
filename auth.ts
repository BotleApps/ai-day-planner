import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { verifyGoogleIdToken } from '@/lib/verify-google-token';

/**
 * Full (Node-runtime) NextAuth instance.
 *
 * Extends the edge-safe `authConfig` with a Credentials provider used by the
 * native iOS / Android shells: the app performs Google Sign-In with the native
 * SDK, then posts the resulting Google ID token here. We verify it server-side
 * and issue the same JWT session as the web OAuth flow — so a user has one
 * identity (their Google `sub`) across web and native.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      id: 'google-native',
      name: 'Google (native)',
      credentials: {
        idToken: { label: 'Google ID token', type: 'text' },
      },
      async authorize(credentials) {
        const idToken = credentials?.idToken;
        if (typeof idToken !== 'string' || !idToken) return null;

        const payload = await verifyGoogleIdToken(idToken);
        if (!payload?.sub) return null;

        return {
          id: payload.sub,
          name: payload.name ?? null,
          email: payload.email ?? null,
          image: payload.picture ?? null,
        };
      },
    }),
  ],
});
