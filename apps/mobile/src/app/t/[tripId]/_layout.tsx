import { api } from "@together/backend/api";
import { colors } from "@together/shared/tokens";
import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { fontFor } from "@/lib/fonts";
import { useLocale, useT } from "@/lib/i18n";
import { TripProvider } from "@/lib/trip";

/**
 * Every /t/<trip> screen: resolves the link (a Convex id, or the Firestore id
 * of a migrated trip), checks the caller is a member, then provides the trip.
 * The tabs live in (tabs); detail and tool screens push over them.
 */
export default function TripLayout() {
  const t = useT();
  const { locale } = useLocale();
  const { tripId: ref } = useLocalSearchParams<{ tripId: string }>();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const tripId = useQuery(api.trips.resolve, isAuthenticated ? { ref: String(ref) } : "skip");
  const data = useQuery(api.trips.get, tripId ? { tripId } : "skip");

  if (!isLoading && !isAuthenticated) return <Redirect href="/welcome" />;
  if (tripId === null) return <Redirect href="/trips" />;
  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.chart50 }}>
        <ActivityIndicator color={colors.ink500} />
      </View>
    );
  }

  const title = { fontFamily: fontFor(locale, "semibold", false), color: colors.ink900 };
  return (
    <TripProvider value={data}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.chart50 },
          headerTitleStyle: title,
          headerTintColor: colors.ink900,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.chart50 },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="documents" options={{ title: t("money.docs.title") }} />
        <Stack.Screen name="families" options={{ title: "" }} />
        <Stack.Screen name="invites" options={{ title: t("product.admin.inviteTitle") }} />
        <Stack.Screen name="members" options={{ title: "" }} />
        <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
        <Stack.Screen name="expenses" options={{ title: "" }} />
        <Stack.Screen name="expense/new" options={{ presentation: "modal", title: t("money.add.title") }} />
        <Stack.Screen name="polls" options={{ title: "" }} />
        <Stack.Screen name="poll/new" options={{ presentation: "modal", title: t("polls.new.title") }} />
        <Stack.Screen name="event/[eventId]" options={{ title: "" }} />
        <Stack.Screen name="event/new" options={{ presentation: "modal", title: t("trip.quickAdd.addEvent") }} />
        <Stack.Screen name="place/[placeId]" options={{ title: "", headerTransparent: true }} />
        <Stack.Screen name="place/new" options={{ presentation: "modal", title: t("trip.newPlace.title") }} />
      </Stack>
    </TripProvider>
  );
}
