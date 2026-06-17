'use client';

/**
 * Native Google Sign-In helper.
 *
 * On iOS / Android (Capacitor) the embedded web view cannot complete Google's
 * web OAuth flow (Google blocks it with `disallowed_useragent`). Instead we use
 * the native Google SDK via @capgo/capacitor-social-login to obtain a Google ID
 * token, then hand that token to NextAuth's `google-native` Credentials provider
 * which verifies it server-side and issues a normal session.
 *
 * All Capacitor imports are dynamic so this module is inert on the web.
 */

let initialized = false;

/** True when running inside the native iOS / Android shell. */
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({
    google: {
      // Web client ID doubles as the serverClientId used to mint the ID token
      // on Android and to validate it on our backend.
      webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      // iOS uses its own client ID (reversed value also goes in Info.plist).
      iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      mode: 'online',
    },
  });
  initialized = true;
}

/**
 * Runs the native Google Sign-In flow and returns a Google ID token (JWT)
 * to be exchanged with the `google-native` NextAuth provider.
 */
export async function nativeGoogleSignIn(): Promise<string> {
  await ensureInitialized();
  const { SocialLogin } = await import('@capgo/capacitor-social-login');

  const response = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });

  const result = response.result;
  if (result.responseType !== 'online' || !result.idToken) {
    throw new Error('Google Sign-In did not return an ID token.');
  }
  return result.idToken;
}
