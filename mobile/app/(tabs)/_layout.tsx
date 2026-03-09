import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../shared/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Compare',  tabBarIcon: () => <TabIcon icon="🔍" /> }}
      />
      <Tabs.Screen
        name="basket"
        options={{ title: 'Basket',   tabBarIcon: () => <TabIcon icon="🧺" /> }}
      />
      <Tabs.Screen
        name="offers"
        options={{ title: 'Offers',   tabBarIcon: () => <TabIcon icon="🏷️" /> }}
      />
      <Tabs.Screen
        name="split"
        options={{ title: 'Split',    tabBarIcon: () => <TabIcon icon="🧾" /> }}
      />
      <Tabs.Screen
        name="trends"
        options={{ title: 'Trends',   tabBarIcon: () => <TabIcon icon="📈" /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: () => <TabIcon icon="⚙️" /> }}
      />
    </Tabs>
  );
}

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 22 }}>{icon}</Text>;
}