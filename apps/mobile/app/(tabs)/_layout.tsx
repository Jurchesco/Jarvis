import { Tabs } from "expo-router";
import { BarChart3, History as HistoryIcon, House, Settings2 } from "lucide-react-native";
import { ICON_SIZE, ICON_STROKE } from "../../src/components/ui";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0b1220" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#7c8aa5",
        tabBarStyle: {
          backgroundColor: "#0b1220",
          borderTopColor: "#24324a",
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Główna",
          tabBarIcon: ({ color }) => (
            <House size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historia",
          tabBarIcon: ({ color }) => (
            <HistoryIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Statystyki",
          tabBarIcon: ({ color }) => (
            <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ustawienia",
          tabBarIcon: ({ color }) => (
            <Settings2 size={ICON_SIZE} strokeWidth={ICON_STROKE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
