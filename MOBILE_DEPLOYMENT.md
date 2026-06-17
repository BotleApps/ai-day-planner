# Mobile Deployment Guide — SortedPlan

SortedPlan ships to **iOS and Android** as a native app using **Capacitor**.

## Why the "remote server" model (and not a static export)

This app is **not** a static site. It uses:

- Next.js **API routes** (`/api/*`)
- **Prisma + PostgreSQL** (server-side)
- **NextAuth + Google OAuth** (server-side sessions/cookies)

Because of that, a static `next export` won't work. The native shell instead
loads the **deployed web app over HTTPS** (Capacitor's `server.url`). You get a
real native app (App Store / Play Store, native splash, status bar, back button,
deep links) backed by your live Cloud Foundry backend — and every web deploy
instantly updates the app, no resubmission needed for web-layer changes.

```
┌────────────────────┐        HTTPS        ┌──────────────────────────┐
│  iOS / Android app │  ───────────────▶   │  Deployed Next.js (BTP)  │
│  (Capacitor shell) │                     │  API + Prisma + Auth     │
└────────────────────┘                     └──────────────────────────┘
```

The relevant config lives in [`capacitor.config.ts`](capacitor.config.ts) and the
native niceties (status bar, splash, Android back button, deep links) in
[`components/native-bridge.tsx`](components/native-bridge.tsx).

---

## Prerequisites

- Node.js 20.x, npm
- **iOS:** macOS + Xcode + CocoaPods (`sudo gem install cocoapods`)
- **Android:** Android Studio + JDK 17

The Capacitor packages are already in `package.json`. Run `npm install` once.

---

## One-time setup: add the native projects

Choose the deployed URL for the landscape you want to wrap (dev / qual / prod),
then add the platforms. `CAP_SERVER_URL` is baked into the native config at
`cap sync` time.

```bash
# Point the shell at a deployed environment (example: dev)
export CAP_SERVER_URL="https://<your-dev-app>.cfapps.eu12.hana.ondemand.com"

# Add platforms (creates ios/ and android/ project folders — commit them)
npm run cap:add:ios       # macOS + Xcode only
npm run cap:add:android
```

> The app id is `com.sortedplan.app` and the app name is `SortedPlan`
> (set in `capacitor.config.ts`). Change them there before adding platforms if needed.

---

## Build & run

```bash
# Sync config + web fallback into the native projects, then open the IDE:
export CAP_SERVER_URL="https://<your-app-url>"

npm run cap:ios       # cap sync ios && cap open ios          → Run in Xcode
npm run cap:android   # cap sync android && cap open android  → Run in Android Studio
```

Run on a simulator/emulator or a physical device from the IDE.

Whenever you change `capacitor.config.ts`, the target server URL, or
`mobile/www/`, re-run `npm run cap:sync` (or the per-platform scripts).

> **Local testing tip:** to point the app at a dev server on your machine, use
> `http://localhost:3000` for the iOS simulator and `http://10.0.2.2:3000` for
> the Android emulator. `capacitor.config.ts` auto-enables cleartext for those.

---

## Google Sign-In inside the native shell

Google **blocks OAuth in embedded web views** (`disallowed_useragent`), so the
plain web `signIn('google')` redirect cannot complete inside a native WebView.
This project solves it with **true native Google Sign-In**, already wired up:

- The sign-in button in [`app/sign-in/sign-in-client.tsx`](app/sign-in/sign-in-client.tsx)
  detects the native platform and calls
  [`lib/native-google-auth.ts`](lib/native-google-auth.ts), which uses
  `@capgo/capacitor-social-login` (native Google SDK / Credential Manager) to
  obtain a Google **ID token** — no WebView OAuth involved.
- That ID token is exchanged with the `google-native` NextAuth Credentials
  provider in [`auth.ts`](auth.ts). The token is verified server-side in
  [`lib/verify-google-token.ts`](lib/verify-google-token.ts) and a normal JWT
  session is issued — the **same identity** (`Google sub`) as the web flow.
- The middleware uses the edge-safe [`auth.config.ts`](auth.config.ts) so the
  Node-only verification library never enters the Edge bundle.

### Per-platform OAuth clients (the setup work)

Create these in Google Cloud Console → Credentials and wire them to env vars:

| Platform | Client type | Used as | Notes |
|----------|-------------|---------|-------|
| Web | Web application | `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Also the **serverClientId** for Android and a valid token audience. Keep the web redirect URI `{NEXTAUTH_URL}/api/auth/callback/google`. |
| iOS | iOS | `GOOGLE_IOS_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Add the **reversed client ID** as a URL scheme in `ios/App/App/Info.plist` (`CFBundleURLTypes`). |
| Android | Android | `GOOGLE_ANDROID_CLIENT_ID` | Registered with package `com.sortedplan.app` + the **SHA-1** of every signing key (debug **and** release/upload key). Uses the web client ID as serverClientId to mint the ID token. |

The backend accepts an ID token whose `aud` matches **any** of the three client
IDs, so all platforms resolve to one account. Set `NEXT_PUBLIC_*` at **web build
time** (they are baked into the bundle the native shell loads remotely).

PWA "Add to Home Screen" in a real browser is unaffected — that runs Google
OAuth in the actual browser.

---

## Updating the app

- **Web/UI/API changes:** just deploy the web app (`./deploy.sh <env>`). The
  native app picks them up on next launch — no rebuild/resubmit.
- **Native changes** (icons, splash, plugins, app id, server URL): re-run
  `npm run cap:sync` and rebuild in Xcode / Android Studio.

---

## Icons & splash

Use the official asset tool with a 1024×1024 source image:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#6366f1' --splashBackgroundColor '#0f0f23'
```

---

## App Store submission

### iOS App Store
1. Apple Developer account ($99/yr)
2. Set bundle id `com.sortedplan.app`, signing team in Xcode
3. Archive → distribute via App Store Connect

### Google Play
1. Google Play Developer account ($25 one-time)
2. Generate a signed AAB in Android Studio
3. Upload in the Play Console

---

## Web install (no app stores)

The web app is still installable from a browser via **Add to Home Screen**
using [`public/manifest.json`](public/manifest.json). It is now **native-only**
for the app-store path: the offline service worker has been removed to keep a
single, predictable delivery model (the app always loads the latest deployed
web build). A small cleanup in
[`components/service-worker-registration.tsx`](components/service-worker-registration.tsx)
unregisters any service worker left over from older PWA builds.

---

## CI/CD (GitHub Actions)

Workflows live in [`.github/workflows`](.github/workflows):

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | push to `main`, PRs | `npm ci` → Prisma generate → lint → type-check → build |
| `deploy-web.yml` | push to `main`, manual | Runs `deploy.sh` against Cloud Foundry (env selectable) |
| `build-android.yml` | manual, `v*` / `android-v*` tags | `cap add/sync android` → `bundleRelease` → sign AAB |
| `build-ios.yml` | manual, `v*` / `ios-v*` tags | `cap add/sync ios` → `pod install` → archive → export IPA |

**Where native builds happen:** on GitHub-hosted runners — `ubuntu-latest` for
Android (JDK 17 + Android SDK), `macos-14` for iOS (Xcode). The `ios/` and
`android/` folders are generated by `cap add` during the run, so they don't need
to be committed.

Required repository **secrets**:

- Deploy: `CF_USERNAME`, `CF_PASSWORD`, `CF_APP_URL`, `CF_DB_SERVICE_NAME`,
  `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`,
  `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`,
  `ENCRYPTION_KEY` (optional), `CF_ORIGIN` (optional).
- Android signing: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `CAP_SERVER_URL`.
- iOS signing: `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`,
  `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_PROVISIONING_PROFILE_NAME`,
  `IOS_TEAM_ID`, `CAP_SERVER_URL`.

Native build jobs run unsigned (for verification) when signing secrets are
absent, so you can validate the pipeline before configuring store credentials.

## Troubleshooting

- **iOS build:** latest Xcode, valid signing team, unique bundle id, run
  `cd ios/App && pod install` if Pods are missing.
- **Android build:** JDK 17, Android SDK installed, accept SDK licenses.
- **Blank screen on launch:** `CAP_SERVER_URL` was unset/wrong at `cap sync`
  time — re-export it and re-sync.
- **Mixed content / blocked request:** the server URL must be HTTPS in
  production (cleartext is only auto-enabled for localhost/emulator URLs).

## Resources
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor remote server config](https://capacitorjs.com/docs/config#server)
