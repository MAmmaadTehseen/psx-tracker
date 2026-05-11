import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../lib/store';
import { C, S } from '../lib/design';

type Feature = { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string };

const FEATURES: Feature[] = [
  { icon: 'trending-up',  title: 'Live Market Data',   desc: 'KSE-100, KSE-30, all sectors — refreshed every 5 minutes during trading hours.' },
  { icon: 'briefcase',    title: 'Portfolio P&L',       desc: 'Log trades, see unrealized gains, average cost basis, and realized returns.' },
  { icon: 'cash-outline', title: 'Dividend Tracker',    desc: 'Income calendar, yield on cost, full payout history per holding.' },
  { icon: 'bar-chart',    title: 'Candlestick Charts',  desc: '1W · 1M · 3M · 6M · 1Y ranges. Tap any stock for an instant chart.' },
];

const STATS = [
  { value: '500+',  label: 'Stocks' },
  { value: '5 min', label: 'Updates' },
  { value: 'Free',  label: 'Forever' },
];

export default function LandingScreen() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn) router.replace('/(tabs)');
  }, [isLoggedIn]);

  return (
    <LinearGradient
      colors={[C.void, '#060f1e', '#0a1628']}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 72, paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 36 }}>
          <LinearGradient
            colors={[C.primary, C.primaryDark]}
            style={{
              width: 48, height: 48, borderRadius: 14,
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
              ...S.glow,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>P</Text>
          </LinearGradient>
          <View>
            <Text style={{ color: C.t1, fontWeight: '800', fontSize: 18, letterSpacing: 0.3 }}>
              PSX{' '}
              <Text style={{ color: C.primary }}>Tracker</Text>
            </Text>
            <Text style={{ color: C.t3, fontSize: 11, letterSpacing: 0.5 }}>Pakistan Stock Exchange</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: C.t1, fontSize: 38, fontWeight: '900', lineHeight: 44, marginBottom: 14 }}>
            Pakistan's Premier{'\n'}Stock Tracker.
          </Text>
          <Text style={{ color: C.t2, fontSize: 15, lineHeight: 24 }}>
            Proper charts. Real P&L. Dividend history.{'\n'}Everything broker apps are missing — free, always.
          </Text>
        </View>

        {/* Stats strip */}
        <View style={{
          flexDirection: 'row',
          borderRadius: 18,
          marginBottom: 32,
          overflow: 'hidden',
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.b1,
          ...S.card,
        }}>
          {STATS.map((s, i) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 18,
                borderRightWidth: i < STATS.length - 1 ? 1 : 0,
                borderRightColor: C.b1,
              }}
            >
              <Text style={{ color: C.primary, fontWeight: '800', fontSize: 20, fontVariant: ['tabular-nums'] }}>{s.value}</Text>
              <Text style={{ color: C.t3, fontSize: 11, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Feature cards */}
        <View style={{ gap: 12, marginBottom: 36 }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                borderRadius: 16,
                padding: 16,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.b1,
                ...S.card,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
                marginRight: 14, marginTop: 1,
                backgroundColor: C.dim,
              }}>
                <Ionicons name={f.icon} size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14, marginBottom: 5 }}>{f.title}</Text>
                <Text style={{ color: C.t2, fontSize: 13, lineHeight: 19 }}>{f.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.t3} style={{ marginTop: 3 }} />
            </View>
          ))}
        </View>

        {/* CTA buttons */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          activeOpacity={0.82}
          style={{ borderRadius: 16, marginBottom: 12, ...S.glow }}
        >
          <LinearGradient
            colors={[C.primary, C.primaryDark]}
            style={{ borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
              Get Started — it's free
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.82}
          style={{
            borderRadius: 16, paddingVertical: 17, alignItems: 'center',
            borderWidth: 1, borderColor: C.b2,
            backgroundColor: 'transparent',
          }}
        >
          <Text style={{ color: C.t2, fontWeight: '600', fontSize: 15 }}>Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}
