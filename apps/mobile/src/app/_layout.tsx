import "@/lib/polyfills";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { colors } from "@together/shared/tokens";
import { useFonts } from "expo-font";
import { DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, Text as RNText, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { authClient, convex } from "@/lib/convex";
import { FONT_ASSETS } from "@/lib/fonts";
import { PushBridge } from "@/components/trip/PushBridge";
import { LocaleProvider } from "@/lib/i18n";

SplashScreen.preventAutoHideAsync();

/** Any screen that throws shows this instead of closing the app (e.g. a request that fails mid sign-in). */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32, backgroundColor: colors.chart50 }}>
      <RNText style={{ fontSize: 20, fontWeight: "600", color: colors.ink900, textAlign: "center" }}>Something went wrong</RNText>
      <RNText style={{ fontSize: 16, color: colors.ink500, textAlign: "center" }}>Please try again.</RNText>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.ink900 }}>
        <RNText style={{ color: colors.chart50, fontWeight: "600", fontSize: 16 }}>Try again</RNText>
      </Pressable>
    </View>
  );
}

// The provider's type only models the convex plugin; ours also carries the
// expo, anonymous and email-OTP plugins (a superset at runtime).
const providerClient = authClient as unknown as AuthClient;

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.chart50, primary: colors.ink900, card: colors.chart50 } };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexBetterAuthProvider client={convex} authClient={providerClient}>
        <LocaleProvider>
          <ThemeProvider value={theme}>
            <StatusBar style="dark" />
            <PushBridge />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.chart50 } }} />
          </ThemeProvider>
        </LocaleProvider>
      </ConvexBetterAuthProvider>
    </GestureHandlerRootView>
  );
}
