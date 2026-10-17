import { ScrollView, View } from "react-native";

/** Chips in a wrapping row, or one horizontal scrolling line (`scroll`). */
export function ChipRow({ children, scroll = false }: { children: React.ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
        {children}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}
