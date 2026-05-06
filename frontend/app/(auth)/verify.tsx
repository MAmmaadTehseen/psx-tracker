/**
 * Email verification screen
 * User enters the 6-digit code Cognito sent to their email.
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { verifyEmail } from '../../lib/auth';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyEmail(email!, code.trim());
      Alert.alert('Email verified!', 'You can now sign in.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      // CodeMismatchException = wrong code
      // ExpiredCodeException = code expired (request a new one)
      Alert.alert('Verification failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#0a0e1a] justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-2">Verify Email</Text>
      <Text className="text-gray-400 mb-2">
        We sent a 6-digit code to:
      </Text>
      <Text className="text-emerald-400 font-semibold mb-8">{email}</Text>

      <Text className="text-gray-400 text-sm mb-1">Verification Code</Text>
      <TextInput
        className="bg-[#111827] text-white rounded-xl px-4 py-3 mb-6 border border-[#1f2937] text-center text-2xl tracking-widest"
        placeholder="000000"
        placeholderTextColor="#6b7280"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        onPress={handleVerify}
        disabled={loading || code.length !== 6}
        className={`rounded-xl py-4 items-center ${
          loading || code.length !== 6 ? 'bg-gray-700' : 'bg-emerald-500'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-base">Verify</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
