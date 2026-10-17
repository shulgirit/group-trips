import { colors } from "@together/shared/tokens";
import { useConvexAuth } from "convex/react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

/** Entry: signed-in people go to their trips, everyone else to the welcome. */
export default function Index() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.night950 }}>
        <ActivityIndicator color={colors.brass500} />
      </View>
    );
  }
  return <Redirect href={isAuthenticated ? "/trips" : "/welcome"} />;
}
