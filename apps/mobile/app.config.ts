import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json holds the production identity (togethergroup.app, app.together.trips, scheme together).
 * Development and preview builds get their own identity so both can sit on one phone and talk to
 * the dev domain/backend: togehter.app · app.together.trips.dev · together-dev://
 * Picked by EXPO_PUBLIC_APP_ENV (set per profile in eas.json).
 *
 * Native Google sign-in needs the iOS OAuth client id (public) as a URL scheme:
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<n>-<hash>.apps.googleusercontent.com → plugin option.
 */
const DEV_HOST = "togehter.app";
const PROD_HOST = "togethergroup.app";

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_APP_ENV;
  let result = config as ExpoConfig;

  if (env === "development" || env === "preview") {
    const swap = <T,>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll(PROD_HOST, DEV_HOST));
    result = {
      ...config,
      name: `${config.name} (dev)`,
      scheme: "together-dev",
      ios: { ...swap(config.ios), bundleIdentifier: `${config.ios?.bundleIdentifier}.dev` },
      // The Firebase file only knows the production package, so dev builds go without push on Android
      android: { ...swap({ ...config.android, googleServicesFile: undefined }), package: `${config.android?.package}.dev` },
    } as ExpoConfig;
  }

  // Expo Go (local dev, no build profile) has no native config to flip, so it reads this flag to render
  // right-to-left. Real builds must NOT set it: expo-localization would then force the PHONE's language
  // direction on every launch and override the language chosen inside the app.
  if (!env) result = { ...result, extra: { ...result.extra, supportsRTL: true } };

  // Android maps need a Google Maps SDK key (public by design; restricted to the app in Google Cloud)
  // Only for Android: EAS sets EAS_BUILD_PLATFORM during builds, and the Android update script sets it too. Without
  // this gate the key would also change the iPhone app's update-compatibility id (its runtime version) and iPhone
  // updates would silently stop reaching builds that are already installed.
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
  if (mapsKey && process.env.EAS_BUILD_PLATFORM === "android") {
    result = { ...result, android: { ...result.android, config: { ...result.android?.config, googleMaps: { apiKey: mapsKey } } } };
  }

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(".apps.googleusercontent.com", "")}`;
    result = { ...result, plugins: [...(result.plugins ?? []), ["@react-native-google-signin/google-signin", { iosUrlScheme }]] };
  }
  return result;
};
