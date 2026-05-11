import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { confirmForgotPassword } from '../../lib/auth';
import { C, S } from '../../lib/design';

function strength(pw: string): { level: number; label: string; color: string } {
  if (pw.length < 8) return { level: 1, label: 'Too short', color: C.bear };
  if (!/\d/.test(pw)) return { level: 2, label: 'Add a number', color: C.gold };
  return { level: 3, label: 'Strong', color: C.bull };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pw = strength(password);
  const canSubmit = !loading && code.length === 6 && pw.level === 3;

  async function handleReset() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await confirmForgotPassword(email!, code.trim(), password);
      Alert.alert('Password reset!', 'You can now sign in with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Reset failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              backgroundColor: C.dim, borderWidth: 1, borderColor: 'rgba(0,212,122,0.3)',
              ...S.glow,
            }}>
              <Ionicons name="key-outline" size={32} color={C.primary} />
            </View>
            <Text style={{ color: C.t1, fontSize: 26, fontWeight: '800', marginBottom: 10 }}>Reset password</Text>
            <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14, marginTop: 4 }}>{email}</Text>
          </View>

          {/* Code */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Reset Code
            </Text>
            <TextInput
              style={{
                backgroundColor: C.raised,
                borderWidth: 1,
                borderColor: focused === 'code' ? C.primary : C.b1,
                borderRadius: 14,
                color: C.t1,
                paddingHorizontal: 16, paddingVertical: 18,
                fontSize: 28, textAlign: 'center', letterSpacing: 12,
                fontVariant: ['tabular-nums'],
                ...(focused === 'code' ? S.glow : {}),
              }}
              placeholder="000000"
              placeholderTextColor={C.t4}
              value={code}
              onChangeText={setCode}
              onFocus={() => setFocused('code')}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* New password */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              New Password
            </Text>
            <View style={{
              backgroundColor: C.raised, borderWidth: 1,
              borderColor: focused === 'pw' ? C.primary : C.b1,
              borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
              ...(focused === 'pw' ? S.glow : {}),
            }}>
              <TextInput
                style={{ flex: 1, color: C.t1, paddingVertical: 16, fontSize: 15, fontVariant: ['tabular-nums'] }}
                placeholder="New password"
                placeholderTextColor={C.t4}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingLeft: 12, paddingVertical: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.t3} />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                {[1, 2, 3].map((n) => (
                  <View key={n} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: n <= pw.level ? pw.color : C.b2 }} />
                ))}
                <Text style={{ color: pw.color, fontSize: 11, fontWeight: '600', minWidth: 60 }}>{pw.label}</Text>
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleReset}
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
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Reset Password</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
                <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Reset Password</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: C.t2, fontSize: 14 }}>
              Didn't get a code?{' '}
              <Text style={{ color: C.primary, fontWeight: '600' }}>Go back</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
