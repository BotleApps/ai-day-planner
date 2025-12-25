# Mobile Deployment Guide

This guide explains how to deploy the AI Day Planner to iOS and Android platforms.

## Option 1: Using Capacitor (Recommended)

Capacitor allows you to build native iOS and Android apps from your web application.

### Prerequisites

- Node.js 18+ and npm
- For iOS: macOS with Xcode installed
- For Android: Android Studio installed

### Installation Steps

1. **Install Capacitor**

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

2. **Initialize Capacitor**

```bash
npx cap init
```

When prompted:
- App name: `AI Day Planner`
- App ID: `com.yourcompany.aidayplanner`
- Web directory: `.next`

3. **Add Platforms**

```bash
# For iOS
npx cap add ios

# For Android
npx cap add android
```

4. **Build Your Web App**

```bash
npm run build
```

5. **Copy Web Assets to Native Projects**

```bash
npx cap sync
```

6. **Open in Native IDE**

```bash
# For iOS
npx cap open ios

# For Android
npx cap open android
```

7. **Run on Device/Simulator**

- **iOS**: In Xcode, select your device/simulator and click Run
- **Android**: In Android Studio, select your device/emulator and click Run

### Updating the App

After making changes to your web app:

```bash
npm run build
npx cap sync
```

## Option 2: Progressive Web App (PWA)

The app can be installed as a PWA on mobile devices.

### Enable PWA

1. **Install next-pwa**

```bash
npm install next-pwa
```

2. **Update next.config.ts**

```typescript
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

export default config;
```

3. **Create manifest.json in public/**

```json
{
  "name": "AI Day Planner",
  "short_name": "Day Planner",
  "description": "Organize your day with AI-powered planning",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

4. **Add to layout.tsx**

```typescript
export const metadata = {
  manifest: '/manifest.json',
};
```

### Installing PWA on Mobile

1. Open the web app in Safari (iOS) or Chrome (Android)
2. Tap the Share button (iOS) or Menu button (Android)
3. Select "Add to Home Screen"
4. The app will be installed like a native app

## Option 3: React Native

For a fully native experience, consider rebuilding with React Native or Expo.

### Using Expo

```bash
npx create-expo-app ai-day-planner-mobile
cd ai-day-planner-mobile
```

You can reuse your components and logic, adapting them to React Native components.

## Environment Variables for Mobile

When building for mobile, ensure you set the correct API URL:

```typescript
// lib/config.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
```

Update API calls to use the full URL:

```typescript
fetch(`${API_URL}/api/tasks`)
```

## Testing

- **iOS Simulator**: Requires macOS
- **Android Emulator**: Available on Windows, macOS, and Linux
- **Physical Devices**: Recommended for final testing

## App Store Submission

### iOS App Store

1. Create an Apple Developer Account ($99/year)
2. Create App ID in Apple Developer Portal
3. Configure signing in Xcode
4. Archive the app
5. Submit via App Store Connect

### Google Play Store

1. Create a Google Play Developer Account ($25 one-time)
2. Create app listing in Google Play Console
3. Generate signed APK/AAB in Android Studio
4. Upload and publish

## Troubleshooting

### iOS Build Issues

- Ensure you have the latest Xcode
- Check code signing settings
- Verify bundle identifier is unique

### Android Build Issues

- Check Android SDK is properly installed
- Verify gradle versions are compatible
- Ensure proper permissions in AndroidManifest.xml

### API Connection Issues

- Use HTTPS in production
- Configure CORS properly
- Set correct API_URL environment variable

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Next.js PWA Guide](https://github.com/shadowwalker/next-pwa)
- [Expo Documentation](https://docs.expo.dev)
- [Apple Developer](https://developer.apple.com)
- [Google Play Console](https://play.google.com/console)
