import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import SessionProvider from "@/components/session-provider";
import ServiceWorkerRegistration from "@/components/service-worker-registration";
import NativeBridge from "@/components/native-bridge";
import { SplashScreen } from "@/components/splash-screen";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { OfflineBanner } from "@/components/offline-banner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SortedPlan",
  description: "AI-powered planning — build beautiful day-by-day schedules, smart checklists, and share with your crew.",
  keywords: ["planner", "day planner", "AI planner", "trip planning", "SortedPlan"],
  authors: [{ name: "SortedPlan" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SortedPlan",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png",   sizes: "32x32",   type: "image/png" },
      { url: "/icons/icon-96x96.png",   sizes: "96x96",   type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required for env(safe-area-inset-*) to report real values on notch /
  // home-indicator devices (iOS standalone PWA + Capacitor native shell).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#6366f1" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ServiceWorkerRegistration />
        <NativeBridge />
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <SplashScreen />
            <PullToRefresh />
            <OfflineBanner />
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
