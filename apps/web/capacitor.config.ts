import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Store apps (iOS + Android) — a native shell around the live web app.
 *
 * The webview loads production (server.url) so every deploy reaches the
 * apps instantly and API routes keep working; native plugins (GPS, push,
 * Google/Apple sign-in, deep links) are reached via window.Capacitor —
 * see src/lib/native.ts. `native-shell/` only holds the offline fallback.
 *
 * Before the first store build: set the final appId + appName, the
 * production domain (universal links), and add GoogleService-Info.plist /
 * google-services.json from Firebase. Full checklist: docs/native-apps.md
 */
const PRODUCTION_URL =
  process.env.CAP_SERVER_URL ?? "https://sicily-together.vercel.app";

const config: CapacitorConfig = {
  appId: "app.together.trips",
  appName: "Together",
  webDir: "native-shell",
  server: {
    url: `${PRODUCTION_URL}/trips`,
    errorPath: "offline.html",
    allowNavigation: [new URL(PRODUCTION_URL).host, "*.firebaseapp.com", "accounts.google.com"],
  },
  // Lets the server tell the store app from a browser (welcome → app onboarding)
  appendUserAgent: "TogetherApp",
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#082433",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
    FirebaseAuthentication: {
      // Native sheets only; the web SDK signs in with the returned credential
      skipNativeAuth: true,
      providers: ["google.com", "apple.com"],
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
