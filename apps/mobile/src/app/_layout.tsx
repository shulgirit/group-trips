import "@/lib/polyfills";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { colors } from "@together/shared/tokens";
import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { authClient, convex } from "@/lib/convex";
import { FONT_ASSETS } from "@/lib/fonts";
import { LocaleProvider } from "@/lib/i18n";

SplashScreen.preventAutoHideAsync();

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
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.chart50 } }} />
          </ThemeProvider>
        </LocaleProvider>
      </ConvexBetterAuthProvider>
    </GestureHandlerRootView>
  );
}
