import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { forgotPassword } from '../../lib/auth';
import { C, S } from '../../lib/design';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = !loading && !!email.trim();

  async function handleSend() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim().toLowerCase() } });
    } catch (err: any) {
      Alert.alert('Failed to send code', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>

          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              backgroundColor: C.dim, borderWidth: 1, borderColor: 'rgba(0,212,122,0.3)',
              ...S.glow,
            }}>
              <Ionicons name="lock-open-outline" size={32} color={C.primary} />
            </View>
            <Text style={{ color: C.t1, fontSize: 26, fontWeight: '800', marginBottom: 10 }}>Forgot password?</Text>
            <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              Enter your email and we'll send a reset code.
            </Text>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Email
            </Text>
            <TextInput
              style={{
                backgroundColor: C.raised,
                borderWidth: 1,
                borderColor: focused ? C.primary : C.b1,
                borderRadius: 14,
                color: C.t1,
                paddingHorizontal: 16, paddingVertical: 16,
                fontSize: 15,
                ...(focused ? S.glow : {}),
              }}
              placeholder="you@example.com"
              placeholderTextColor={C.t4}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSend}
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
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Send Reset Code</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
                <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Send Reset Code</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: C.t2, fontSize: 14 }}>
              Remember it?{' '}
              <Text style={{ color: C.primary, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
