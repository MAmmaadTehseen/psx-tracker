/**
 * Register screen
 *
 * Calls Cognito SignUp — creates user, triggers verification email.
 * After sign-up, redirects to verify screen to enter the 6-digit code.
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { register } from '../../lib/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) return;
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      // Cognito sends a 6-digit verification code to the email
      router.push({ pathname: '/(auth)/verify', params: { email } });
    } catch (err: any) {
      // UsernameExistsException = email already registered
      Alert.alert('Registration failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#0a0e1a] justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-2">Create Account</Text>
      <Text className="text-gray-400 mb-8">Start tracking your PSX portfolio</Text>

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
        placeholder="Min 8 characters, include a number"
        placeholderTextColor="#6b7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        onPress={handleRegister}
        disabled={loading || !email || password.length < 8}
        className={`rounded-xl py-4 items-center mb-4 ${
          loading || !email || password.length < 8 ? 'bg-gray-700' : 'bg-emerald-500'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-base">Create Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} className="items-center py-3">
        <Text className="text-gray-400">
          Already have an account?{' '}
          <Text className="text-emerald-400 font-semibold">Sign in</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
