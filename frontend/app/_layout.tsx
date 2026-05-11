/**
 * Root layout — wraps the entire app.
 * Sets up TanStack Query for API calls and restores Cognito auth on startup.
 */

import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { getTokens } from '../lib/auth';
import { useAuthStore } from '../lib/store';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// QueryClient caches all API responses.
// staleTime: data is considered fresh for 30s before a background refetch.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const setTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    // Restore Cognito session from storage (if user was logged in before)
    getTokens().then(setTokens).finally(() => SplashScreen.hideAsync());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#03060e' },
          headerTintColor: '#e8eef8',
          contentStyle: { backgroundColor: '#03060e' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="stock/[ticker]" options={{ title: '' }} />
        <Stack.Screen name="add-trade" options={{ title: 'Add Trade', presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </QueryClientProvider>
  );
}
