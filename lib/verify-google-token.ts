import { OAuth2Client, type TokenPayload } from 'google-auth-library';

/**
 * Verifies a Google ID token (JWT) obtained from a native client
 * (@capgo/capacitor-social-login on iOS / Android) and returns its payload.
 *
 * The token's `aud` claim must match one of our configured OAuth client IDs.
 * Native platforms each have their own client ID, so we accept all of them:
 *   - GOOGLE_CLIENT_ID          — Web client (also used as serverClientId)
 *   - GOOGLE_IOS_CLIENT_ID      — iOS client
 *   - GOOGLE_ANDROID_CLIENT_ID  — Android client
 *
 * Returns the verified payload, or null if the token is invalid.
 */
const audiences = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter((v): v is string => !!v);

const client = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload | null> {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences.length > 0 ? audiences : undefined,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    // Require a verified email when present.
    if (payload.email && payload.email_verified === false) return null;
    return payload;
  } catch {
    return null;
  }
}
