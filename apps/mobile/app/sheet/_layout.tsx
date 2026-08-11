import { Stack } from "expo-router";

export default function SheetLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#121b2e" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0b1220" },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Arkusz", headerBackTitle: "Start" }} />
    </Stack>
  );
}
