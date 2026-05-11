import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { register } from '../../lib/auth';
import { C, S } from '../../lib/design';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) return;
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters and include a number.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      router.push({ pathname: '/(auth)/verify', params: { email } });
    } catch (err: any) {
      Alert.alert('Registration failed', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && !!email && password.length >= 8;
  const pwStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : /\d/.test(password) ? 3 : 2;
  const strengthColor = ['transparent', C.bear, C.gold, C.bull][pwStrength];
  const strengthLabel = ['', 'Too short', 'Add a number', 'Strong'][pwStrength];

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
            <Text style={{ color: C.t1, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>Create Account</Text>
            <Text style={{ color: C.t2, fontSize: 14 }}>Start tracking your PSX portfolio</Text>
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
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Password
            </Text>
            <View style={{ ...inputStyle('password'), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <TextInput
                style={{ flex: 1, color: C.t1, paddingVertical: 16, fontSize: 15, fontVariant: ['tabular-nums'] }}
                placeholder="Min 8 characters, include a number"
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

          {/* Password strength */}
          <View style={{ marginBottom: 24, minHeight: 28 }}>
            {password.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                  {[1, 2, 3].map((n) => (
                    <View
                      key={n}
                      style={{
                        flex: 1, height: 3, borderRadius: 3,
                        backgroundColor: pwStrength >= n ? strengthColor : C.b1,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: strengthColor, fontWeight: '600' }}>{strengthLabel}</Text>
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRegister}
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
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create Account</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
                <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Create Account</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.b1 }} />
            <Text style={{ color: C.t3, fontSize: 11, marginHorizontal: 14 }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.b1 }} />
          </View>

          {/* Login link */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{ borderRadius: 14, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.b2 }}
          >
            <Text style={{ color: C.t2, fontSize: 15 }}>
              Already have an account?{' '}
              <Text style={{ color: C.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
