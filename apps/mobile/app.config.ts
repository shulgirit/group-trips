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
      android: { ...swap(config.android), package: `${config.android?.package}.dev` },
    } as ExpoConfig;
  }

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(".apps.googleusercontent.com", "")}`;
    result = { ...result, plugins: [...(result.plugins ?? []), ["@react-native-google-signin/google-signin", { iosUrlScheme }]] };
  }
  return result;
};
