import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

function TabIcon({ name, color, size, focused }: { name: any; color: string; size: number; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 32,
      borderRadius: 10,
      backgroundColor: focused ? 'rgba(0,212,122,0.12)' : 'transparent',
    }}>
      <Ionicons name={name} size={size - 2} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#07101d',
          borderTopColor: '#162034',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#00d47a',
        tabBarInactiveTintColor: '#3d5268',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        headerStyle: { backgroundColor: '#03060e' },
        headerTintColor: '#e8eef8',
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#e8eef8' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="trending-up" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="search" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="bookmark" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="briefcase" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dividends"
        options={{
          title: 'Dividends',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="cash" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
