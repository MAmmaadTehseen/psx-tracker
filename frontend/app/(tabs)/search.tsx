import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { C, S } from '../../lib/design';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [sector, setSector] = useState<string>('All');

  const { data, isLoading } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.getStocks(),
    staleTime: Infinity,
  });

  const stocks = data?.stocks ?? [];

  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s: any) => { if (s.sector) set.add(s.sector); });
    return ['All', ...Array.from(set).sort()];
  }, [stocks]);

  const filtered = useMemo(() => {
    let result = stocks;
    if (sector !== 'All') result = result.filter((s: any) => s.sector === sector);
    if (query.length >= 1) {
      result = result.filter((s: any) =>
        s.ticker.includes(query.toUpperCase()) ||
        (s.name ?? '').toLowerCase().includes(query.toLowerCase())
      );
    } else {
      result = result.slice(0, 30);
    }
    return result;
  }, [stocks, query, sector]);

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: C.raised, borderRadius: 16,
          borderWidth: 1, borderColor: focused ? C.primary : C.b1,
          paddingHorizontal: 14,
          ...(focused ? S.glow : {}),
        }}>
          <Ionicons name="search" size={18} color={focused ? C.primary : C.t3} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, color: C.t1, paddingVertical: 14, fontSize: 15 }}
            placeholder="Search ticker or company…"
            placeholderTextColor={C.t4}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={{ paddingLeft: 8 }}>
              <Ionicons name="close-circle" size={18} color={C.t3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Skeleton — first load before any stocks arrive */}
      {isLoading && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < 5 ? 1 : 0, borderBottomColor: '#0f1d2e' }}>
              <SearchSkeleton h={42} w={42} r={12} />
              <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
                <SearchSkeleton h={14} w="50%" />
                <SearchSkeleton h={11} w="35%" />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8, marginRight: 14 }}>
                <SearchSkeleton h={14} w={60} />
                <SearchSkeleton h={20} w={52} r={6} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sector filter chips */}
      {stocks.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 42 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
        >
          {sectors.map((s) => {
            const active = sector === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSector(s)}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: active ? C.dim : C.raised,
                  borderWidth: 1, borderColor: active ? C.primary : C.b2,
                }}
              >
                <Text style={{ color: active ? C.primary : C.t2, fontSize: 12, fontWeight: active ? '700' : '500' }}>
                  {s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Results count */}
      <Text style={{ color: C.t3, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        {query.length > 0
          ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
          : `Showing ${filtered.length} stocks`}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.ticker}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#0f1d2e' }} />}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <Ionicons name="search-outline" size={40} color={C.t3} />
            <Text style={{ color: C.t2, fontSize: 14, marginTop: 12 }}>No stocks match "{query}"</Text>
            <Text style={{ color: C.t3, fontSize: 12, marginTop: 4 }}>Try a different ticker or name</Text>
          </View>
        )}
        renderItem={({ item }: { item: any }) => {
          const isUp = (item.changePct ?? 0) >= 0;
          const sign = isUp ? '+' : '';
          return (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}
              activeOpacity={0.75}
              onPress={() => router.push(`/stock/${item.ticker}`)}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: isUp ? C.bullBg : C.bearBg }}>
                <Text style={{ color: isUp ? C.primary : C.bear, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
                  {item.ticker.slice(0, 4)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.t1, fontWeight: '600', fontSize: 14 }}>{item.ticker}</Text>
                <Text style={{ color: C.t2, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                  {item.name ?? item.sector ?? ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }}>
                  {item.close ? `${Number(item.close).toFixed(2)}` : '—'}
                </Text>
                <View style={{ marginTop: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: isUp ? C.bullBg : C.bearBg }}>
                  <Text style={{ color: isUp ? C.bull : C.bear, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {item.changePct != null ? `${sign}${Number(item.changePct).toFixed(2)}%` : '—'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.t3} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function useSearchPulse() {
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

function SearchSkeleton({ h, w, r = 8 }: { h: number; w?: number | `${number}%`; r?: number }) {
  const opacity = useSearchPulse();
  return <Animated.View style={{ height: h, width: w ?? '100%', borderRadius: r, backgroundColor: C.raised, opacity }} />;
}
