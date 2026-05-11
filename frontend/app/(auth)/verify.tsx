import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { verifyEmail, resendVerificationCode } from '../../lib/auth';
import { C, S } from '../../lib/design';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyEmail(email!, code.trim());
      Alert.alert('Email verified!', 'You can now sign in.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Verification failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await resendVerificationCode(email);
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Failed to resend', err.message ?? 'Unknown error');
    } finally {
      setResending(false);
    }
  }

  const canSubmit = !loading && code.length === 6;

  return (
    <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>

          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              backgroundColor: C.dim,
              borderWidth: 1, borderColor: 'rgba(0,212,122,0.3)',
              ...S.glow,
            }}>
              <Ionicons name="mail-outline" size={32} color={C.primary} />
            </View>
            <Text style={{ color: C.t1, fontSize: 26, fontWeight: '800', marginBottom: 10 }}>Check your email</Text>
            <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              We sent a 6-digit code to
            </Text>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14, marginTop: 4 }}>{email}</Text>
          </View>

          {/* Code input */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Verification Code
            </Text>
            <TextInput
              style={{
                backgroundColor: C.raised,
                borderWidth: 1,
                borderColor: focused ? C.primary : C.b1,
                borderRadius: 14,
                color: C.t1,
                paddingHorizontal: 16,
                paddingVertical: 18,
                fontSize: 28,
                textAlign: 'center',
                letterSpacing: 12,
                fontVariant: ['tabular-nums'],
                ...(focused ? S.glow : {}),
              }}
              placeholder="000000"
              placeholderTextColor={C.t4}
              value={code}
              onChangeText={setCode}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={{ borderRadius: 14, marginBottom: 16, ...(canSubmit ? S.glow : {}) }}
          >
            {canSubmit ? (
              <LinearGradient
                colors={[C.primary, C.primaryDark]}
                style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Verify Email</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
                <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Verify Email</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={resending} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: C.t2, fontSize: 14 }}>
              {resending ? 'Sending…' : (
                <>Didn't receive it?{' '}<Text style={{ color: C.primary, fontWeight: '600' }}>Resend code</Text></>
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/register')} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: C.t3, fontSize: 13 }}>
              Wrong email?{' '}
              <Text style={{ color: C.t2, fontWeight: '600' }}>Go back</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
