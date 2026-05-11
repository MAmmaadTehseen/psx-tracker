import { ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import { api, Index, IndexHistoryPoint } from '../../lib/api';
import { C, S } from '../../lib/design';

const INDICES = [
  { key: 'KSE_100', label: 'KSE-100' },
  { key: 'KSE_30',  label: 'KSE-30'  },
  { key: 'KMI_30',  label: 'KMI-30'  },
];

function isMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const mins = h * 60 + m;
  // PSX: Mon–Fri, 04:15–10:30 UTC
  return day >= 1 && day <= 5 && mins >= 255 && mins < 630;
}

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 10)   return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function MarketScreen() {
  const router = useRouter();
  const open = isMarketOpen();
  const [, tick] = useState(0);

  // Re-render every 30 s so the "X min ago" label stays accurate
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, isError, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.getStocks(),
  });

  const indicesQuery = useQuery({
    queryKey: ['indices'],
    queryFn: api.getIndices,
    refetchInterval: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ['indices-history'],
    queryFn: () => api.getIndicesHistory(30),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const stocks = data?.stocks ?? [];
  const indicesData = indicesQuery.data?.indices ?? [];
  const indexHistory = historyQuery.data?.history ?? {};

  const gainers = [...stocks]
    .sort((a: any, b: any) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 10);

  const losers = [...stocks]
    .sort((a: any, b: any) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.void }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Market status banner */}
      <View style={{
        marginHorizontal: 16, marginTop: 16, marginBottom: 4,
        borderRadius: 12,
        backgroundColor: open ? 'rgba(0,212,122,0.08)' : 'rgba(242,54,69,0.07)',
        borderWidth: 1,
        borderColor: open ? 'rgba(0,212,122,0.2)' : 'rgba(242,54,69,0.18)',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
      }}>
        <View style={{
          width: 7, height: 7, borderRadius: 4,
          backgroundColor: open ? C.bull : C.bear,
          marginRight: 10,
        }} />
        <Text style={{
          fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
          color: open ? C.bull : C.bear, flex: 1,
        }}>
          {open ? 'Market Open' : 'Market Closed'}
        </Text>
        <Text style={{ color: C.t3, fontSize: 11 }}>
          {dataUpdatedAt ? `Updated ${timeAgo(dataUpdatedAt)}` : (open ? 'Mon–Fri 09:15–15:30 PKT' : 'Next: Mon 09:15 PKT')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>

        {/* Section: Indices */}
        <SectionHeader title="Indices" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {INDICES.map((idx) => {
            const indexData = indicesData.find((i) => i.name === idx.key) ?? null;
            const history = (indexHistory[idx.key] ?? []).slice().reverse();
            return <IndexCard key={idx.key} label={idx.label} data={indexData} history={history} />;
          })}
        </View>

        {/* Section: Sector Heatmap */}
        {stocks.length > 0 && (() => {
          const sectorMap = new Map<string, number[]>();
          stocks.forEach((s: any) => {
            if (!s.sector || s.changePct == null) return;
            if (!sectorMap.has(s.sector)) sectorMap.set(s.sector, []);
            sectorMap.get(s.sector)!.push(Number(s.changePct));
          });
          const sectors = Array.from(sectorMap.entries())
            .map(([name, pcts]) => ({ name, changePct: pcts.reduce((a, b) => a + b, 0) / pcts.length }))
            .sort((a, b) => b.changePct - a.changePct);
          return (
            <>
              <SectionHeader title="Sectors Today" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {sectors.map((sec) => {
                  const secUp = sec.changePct >= 0;
                  const intensity = Math.min(Math.abs(sec.changePct) / 3, 1);
                  return (
                    <View key={sec.name} style={{
                      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                      backgroundColor: secUp ? `rgba(0,212,122,${0.08 + intensity * 0.18})` : `rgba(242,54,69,${0.08 + intensity * 0.18})`,
                      borderWidth: 1,
                      borderColor: secUp ? 'rgba(0,212,122,0.2)' : 'rgba(242,54,69,0.2)',
                      minWidth: '30%',
                    }}>
                      <Text style={{ color: C.t2, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }} numberOfLines={1}>
                        {sec.name.length > 12 ? sec.name.slice(0, 12) + '…' : sec.name}
                      </Text>
                      <Text style={{ color: secUp ? C.bull : C.bear, fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] }}>
                        {secUp ? '+' : ''}{sec.changePct.toFixed(2)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          );
        })()}

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={{ color: C.t2, fontSize: 13, marginTop: 12 }}>Loading market data…</Text>
          </View>
        )}

        {isError && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.t3} />
            <Text style={{ color: C.t2, fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 }}>
              Failed to load market data.{'\n'}Pull down to retry.
            </Text>
          </View>
        )}

        {!isLoading && !isError && stocks.length > 0 && (
          <>
            <SectionHeader title="Top Gainers" accent={C.bull} />
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.b1, marginBottom: 24, overflow: 'hidden', backgroundColor: C.surface, ...S.card }}>
              {gainers.map((stock: any, i: number) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  isLast={i === gainers.length - 1}
                  onPress={() => router.push(`/stock/${stock.ticker}`)}
                />
              ))}
            </View>

            <SectionHeader title="Top Losers" accent={C.bear} />
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.b1, overflow: 'hidden', backgroundColor: C.surface, ...S.card }}>
              {losers.map((stock: any, i: number) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  isLast={i === losers.length - 1}
                  onPress={() => router.push(`/stock/${stock.ticker}`)}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, accent }: { title: string; accent?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      {accent && (
        <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: accent }} />
      )}
      <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15 }}>{title}</Text>
    </View>
  );
}

function IndexCard({ label, data, history }: { label: string; data: Index | null; history: IndexHistoryPoint[] }) {
  const isUp = (data?.changePct ?? 0) >= 0;
  const sign = isUp ? '+' : '';
  const hasData = data?.value != null;

  return (
    <LinearGradient
      colors={[C.surface, C.raised]}
      style={{ flex: 1, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.b2, ...S.card }}
    >
      <Text style={{ color: C.t3, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </Text>
      <Text style={{ color: C.t1, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {hasData ? Number(data!.value).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '—'}
      </Text>
      <View style={{
        marginTop: 8, alignSelf: 'flex-start',
        backgroundColor: hasData ? (isUp ? C.bullBg : C.bearBg) : C.dim,
        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
      }}>
        <Text style={{ color: hasData ? (isUp ? C.bull : C.bear) : C.t3, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {hasData ? `${sign}${Number(data!.changePct).toFixed(2)}%` : '—'}
        </Text>
      </View>
      {history.length >= 2 && (
        <IndexSparkline values={history.map(p => p.value)} color={isUp ? C.bull : C.bear} />
      )}
    </LinearGradient>
  );
}

function IndexSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 90, H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`
  ).join(' ');
  return (
    <View style={{ marginTop: 10, opacity: 0.75 }}>
      <Svg width={W} height={H}>
        <Polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function StockRow({ stock, isLast, onPress }: { stock: any; isLast: boolean; onPress: () => void }) {
  const isUp = (stock.changePct ?? 0) >= 0;
  const sign = isUp ? '+' : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#0f1d2e',
      }}
    >
      {/* Ticker badge — colored by today's direction */}
      <View style={{
        width: 42, height: 42, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
        backgroundColor: isUp ? C.bullBg : C.bearBg,
      }}>
        <Text style={{ color: isUp ? C.primary : C.bear, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
          {stock.ticker.slice(0, 4)}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: C.t1, fontWeight: '600', fontSize: 14 }}>{stock.ticker}</Text>
        <Text style={{ color: C.t2, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
          {stock.name ?? stock.sector ?? ''}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
        <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }}>
          {stock.close ? `${Number(stock.close).toFixed(2)}` : '—'}
        </Text>
        <View style={{
          marginTop: 4, borderRadius: 6,
          paddingHorizontal: 7, paddingVertical: 2,
          backgroundColor: isUp ? C.bullBg : C.bearBg,
        }}>
          <Text style={{ color: isUp ? C.bull : C.bear, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {stock.changePct != null ? `${sign}${Number(stock.changePct).toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={C.t3} />
    </TouchableOpacity>
  );
}
