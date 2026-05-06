/**
 * Login screen
 *
 * Calls Cognito's InitiateAuth API via amazon-cognito-identity-js.
 * On success, stores the JWT tokens in Zustand (in-memory) and
 * in Cognito SDK's storage (persisted — survives app restarts).
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '../../lib/auth';
import { useAuthStore } from '../../lib/store';

export default function LoginScreen() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const tokens = await signIn(email.trim().toLowerCase(), password);
      setTokens(tokens);           // update Zustand
      router.replace('/(tabs)');   // go to main app
    } catch (err: any) {
      // Cognito error codes you'll see during testing:
      //   NotAuthorizedException: wrong password
      //   UserNotConfirmedException: email not verified yet
      //   UserNotFoundException: email not registered
      Alert.alert('Login failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#0a0e1a] justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-2">PSX Tracker</Text>
      <Text className="text-gray-400 mb-8">Sign in to your account</Text>

      <Text className="text-gray-400 text-sm mb-1">Email</Text>
      <TextInput
        className="bg-[#111827] text-white rounded-xl px-4 py-3 mb-4 border border-[#1f2937]"
        placeholder="you@example.com"
        placeholderTextColor="#6b7280"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text className="text-gray-400 text-sm mb-1">Password</Text>
      <TextInput
        className="bg-[#111827] text-white rounded-xl px-4 py-3 mb-6 border border-[#1f2937]"
        placeholder="Min 8 characters"
        placeholderTextColor="#6b7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading || !email || !password}
        className={`rounded-xl py-4 items-center mb-4 ${
          loading || !email || !password ? 'bg-gray-700' : 'bg-emerald-500'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-base">Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/register')}
        className="items-center py-3"
      >
        <Text className="text-gray-400">
          No account?{' '}
          <Text className="text-emerald-400 font-semibold">Create one</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
