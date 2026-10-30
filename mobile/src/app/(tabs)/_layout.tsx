import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import type { IconName } from '@/components/ui';
import { useTheme } from '@/lib/theme';

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Overview', icon: 'pie-chart' },
  { name: 'transactions', title: 'Transactions', icon: 'swap-vertical' },
  { name: 'budgets', title: 'Budgets', icon: 'speedometer' },
  { name: 'accounts', title: 'Accounts', icon: 'wallet' },
];

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={(focused ? tab.icon : `${tab.icon}-outline`) as IconName} size={size} color={color as string} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
