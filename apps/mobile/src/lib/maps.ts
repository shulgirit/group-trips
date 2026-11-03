import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Android draws maps with Google Maps, which crashes the app without an API key. iPhone uses Apple Maps.
 * Until EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY is set for a build, the map entries are hidden on Android.
 */
export const MAPS_AVAILABLE = Platform.OS !== "android" || Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);
