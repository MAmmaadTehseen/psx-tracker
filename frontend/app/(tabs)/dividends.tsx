import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore, usePortfolioStore } from '../../lib/store';
import { api } from '../../lib/api';
import { C, S } from '../../lib/design';

const TYPE_COLORS: Record<string, string> = {
  cash:  C.primary,
  bonus: C.gold,
  right: '#3b82f6',
};

export default function DividendsScreen() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeId = usePortfolioStore((s) => s.activePortfolioId);

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', activeId],
    queryFn: () => api.getPortfolio(activeId!),
    enabled: isLoggedIn && !!activeId,
  });

  if (!isLoggedIn) {
    return (
      <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: C.goldBg, borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)', ...S.goldGlow }}>
          <Ionicons name="cash-outline" size={32} color={C.gold} />
        </View>
        <Text style={{ color: C.t1, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Dividend Tracker</Text>
        <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', marginBottom: 36, lineHeight: 22 }}>
          Sign in to track dividend income and yield on cost for your holdings.
        </Text>
        <TouchableOpacity activeOpacity={0.85} style={{ borderRadius: 14, width: '100%', ...S.glow }} onPress={() => router.push('/(auth)/login')}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={{ borderRadius: 14, paddingVertical: 17, alignItems: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const holdings = portfolioQuery.data?.holdings ?? [];

  // Compute total annual income across all holdings (requires dividend data — estimated here)
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.void }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={portfolioQuery.isRefetching}
          onRefresh={() => portfolioQuery.refetch()}
          tintColor={C.primary}
        />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 }}>

        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.gold }} />
          <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15, flex: 1 }}>Dividend Income</Text>
          <Text style={{ color: C.t3, fontSize: 11, letterSpacing: 0.3 }}>by holding</Text>
        </View>

        {portfolioQuery.isLoading && (
          <View style={{ gap: 14 }}>
            {[0,1,2].map(i => (
              <View key={i} style={{ borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden', borderWidth: 1, borderColor: C.b1 }}>
                <View style={{ height: 3, backgroundColor: C.goldBg }} />
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <DivSkeleton h={42} w={42} r={12} />
                      <View style={{ marginLeft: 12, gap: 8 }}>
                        <DivSkeleton h={14} w={80} />
                        <DivSkeleton h={11} w={56} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <DivSkeleton h={15} w={100} />
                      <DivSkeleton h={11} w={80} />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {holdings.map((h: any) => (
          <DividendRow key={h.ticker} ticker={h.ticker} avgCost={h.avgCostPerShare} qty={h.qty} />
        ))}

        {holdings.length === 0 && !portfolioQuery.isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: C.goldBg }}>
              <Ionicons name="cash-outline" size={32} color={C.gold} />
            </View>
            <Text style={{ color: C.t1, fontWeight: '600', fontSize: 15, marginBottom: 6 }}>No holdings yet</Text>
            <Text style={{ color: C.t2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Add holdings to your portfolio{'\n'}to see dividend tracking here.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DividendRow({ ticker, avgCost, qty }: { ticker: string; avgCost: number; qty: number }) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dividends', ticker],
    queryFn: () => api.getDividends(ticker),
    staleTime: 60_000 * 30,
  });

  const dividends = data?.dividends ?? [];
  const lastDiv = dividends[0];
  const annualDivPerShare = lastDiv?.amount ?? 0;
  const yieldOnCost = avgCost > 0 ? ((annualDivPerShare / avgCost) * 100).toFixed(2) : '0.00';
  const totalIncome = (annualDivPerShare * qty).toFixed(0);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/stock/${ticker}`)}
      activeOpacity={0.75}
      style={{ borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: C.b1, backgroundColor: C.surface, overflow: 'hidden', ...S.card }}
    >
      {/* Gold accent top strip */}
      <View style={{ height: 3, backgroundColor: C.gold, opacity: 0.7 }} />

      <View style={{ padding: 16 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: C.goldBg }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
                {ticker.slice(0, 4)}
              </Text>
            </View>
            <View>
              <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14 }}>{ticker}</Text>
              <Text style={{ color: C.t2, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                {qty} shares
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.gold, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] }}>
              PKR {Number(totalIncome).toLocaleString()} / yr
            </Text>
            <Text style={{ color: C.t2, fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] }}>
              {yieldOnCost}% yield on cost
            </Text>
          </View>
        </View>

        {/* Dividend history */}
        {isLoading ? (
          <View style={{ borderTopWidth: 1, borderTopColor: '#0f1d2e', paddingTop: 12, gap: 8 }}>
            <DivSkeleton h={12} w="70%" />
            <DivSkeleton h={12} w="60%" />
          </View>
        ) : dividends.length === 0 ? (
          <Text style={{ color: C.t3, fontSize: 12 }}>No dividend history found.</Text>
        ) : (
          <View style={{ borderTopWidth: 1, borderTopColor: '#0f1d2e', paddingTop: 12, gap: 6 }}>
            {dividends.slice(0, 3).map((d: any) => {
              const typeColor = TYPE_COLORS[d.type?.toLowerCase()] ?? C.t2;
              return (
                <View key={d.exDate} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.t2, fontSize: 12, fontVariant: ['tabular-nums'] }}>Ex: {d.exDate}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: C.t1, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                      PKR {d.amount} / share
                    </Text>
                    <View style={{ backgroundColor: `${typeColor}22`, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: typeColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                        {(d.type ?? 'CASH').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function useDivPulse() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return opacity;
}

function DivSkeleton({ h, w, r = 8 }: { h: number; w?: number | `${number}%`; r?: number }) {
  const opacity = useDivPulse();
  return <Animated.View style={{ height: h, width: w ?? '100%', borderRadius: r, backgroundColor: C.raised, opacity }} />;
}
