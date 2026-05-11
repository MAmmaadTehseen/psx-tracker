import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signIn } from '../../lib/auth';
import { useAuthStore } from '../../lib/store';
import { C, S } from '../../lib/design';

export default function LoginScreen() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const tokens = await signIn(email.trim().toLowerCase(), password);
      setTokens(tokens);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && !!email && !!password;

  const inputStyle = (field: string) => ({
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: focused === field ? C.primary : C.b1,
    borderRadius: 14,
    ...(focused === field ? S.glow : {}),
  });

  return (
    <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand mark */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <LinearGradient
              colors={[C.primary, C.primaryDark]}
              style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...S.glow }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>P</Text>
            </LinearGradient>
            <Text style={{ color: C.t1, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>Welcome back</Text>
            <Text style={{ color: C.t2, fontSize: 14 }}>Sign in to your PSX Tracker account</Text>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Email
            </Text>
            <TextInput
              style={{ ...inputStyle('email'), color: C.t1, paddingHorizontal: 16, paddingVertical: 16, fontSize: 15 }}
              placeholder="you@example.com"
              placeholderTextColor={C.t4}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Password
            </Text>
            <View style={{ ...inputStyle('password'), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <TextInput
                style={{ flex: 1, color: C.t1, paddingVertical: 16, fontSize: 15, fontVariant: ['tabular-nums'] }}
                placeholder="Your password"
                placeholderTextColor={C.t4}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingLeft: 12, paddingVertical: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.t3} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end', marginBottom: 24, paddingVertical: 4 }}
          >
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={{ borderRadius: 14, marginBottom: 20, ...(canSubmit ? S.glow : {}) }}
          >
            {canSubmit ? (
              <LinearGradient
                colors={[C.primary, C.primaryDark]}
                style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Sign In</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
                <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Sign In</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.b1 }} />
            <Text style={{ color: C.t3, fontSize: 11, marginHorizontal: 14 }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.b1 }} />
          </View>

          {/* Register link */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
            style={{ borderRadius: 14, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.b2 }}
          >
            <Text style={{ color: C.t2, fontSize: 15 }}>
              No account?{' '}
              <Text style={{ color: C.primary, fontWeight: '700' }}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
