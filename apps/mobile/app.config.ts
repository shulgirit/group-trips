import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json holds the production identity (togethergroup.app, app.together.trips,
 * scheme together). Development and preview builds get their own identity so
 * both can sit on one phone and talk to the dev domain/backend:
 *   togehter.app · app.together.trips.dev · together-dev://
 * Picked by EXPO_PUBLIC_APP_ENV (set per profile in eas.json).
 */
const DEV_HOST = "togehter.app";
const PROD_HOST = "togethergroup.app";

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_APP_ENV;
  if (env !== "development" && env !== "preview") return config as ExpoConfig;

  const swap = <T,>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll(PROD_HOST, DEV_HOST));
  return {
    ...config,
    name: `${config.name} (dev)`,
    scheme: "together-dev",
    ios: { ...swap(config.ios), bundleIdentifier: `${config.ios?.bundleIdentifier}.dev` },
    android: { ...swap(config.android), package: `${config.android?.package}.dev` },
  } as ExpoConfig;
};
