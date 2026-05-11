import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CartesianChart, Line } from 'victory-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { C, S } from '../../lib/design';
import { fmtNum, fmtPKR } from '../../lib/fmt';
import { useAuthStore } from '../../lib/store';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

export default function StockDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [selectedRange, setSelectedRange] = useState(RANGES[1]);

  const stockQuery = useQuery({
    queryKey: ['stock', ticker, selectedRange.days],
    queryFn: () => api.getStock(ticker!, selectedRange.days),
    enabled: !!ticker,
  });

  const dividendQuery = useQuery({
    queryKey: ['dividends', ticker],
    queryFn: () => api.getDividends(ticker!),
    enabled: !!ticker,
    staleTime: 60_000 * 30,
  });

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  const { stock, prices = [] } = stockQuery.data ?? {};
  const dividends = dividendQuery.data?.dividends ?? [];
  const latestPrice = prices[0];
  const isUp = (latestPrice?.changePct ?? 0) >= 0;

  const isWatched = (watchlistQuery.data?.tickers ?? []).includes(ticker ?? '');

  async function toggleWatchlist() {
    if (!ticker) return;
    try {
      if (isWatched) {
        await api.removeFromWatchlist(ticker);
      } else {
        await api.addToWatchlist(ticker);
      }
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    } catch { /* silent fail */ }
  }

  const chartData = [...prices].reverse().map((p) => ({
    date: new Date(p.date).getTime(),
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
  }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.void }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>

        {/* Header */}
        {stockQuery.isLoading && !stock && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        )}

        {stock && (
          <View style={{ marginBottom: 24 }}>
            {/* Sector + watchlist row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: C.t3, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', flex: 1 }}>
                {stock.sector}
              </Text>
              {isLoggedIn && (
                <TouchableOpacity onPress={toggleWatchlist} activeOpacity={0.7} style={{ padding: 4 }}>
                  <Ionicons
                    name={isWatched ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isWatched ? C.bear : C.t3}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ color: C.t1, fontSize: 26, fontWeight: '900', marginBottom: 2 }}>{stock.ticker}</Text>
            <Text style={{ color: C.t2, fontSize: 15, marginBottom: 16 }}>{stock.name}</Text>

            {latestPrice && (
              <LinearGradient
                colors={[C.surface, C.raised]}
                style={{ borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.b2, ...S.card, overflow: 'hidden' }}
              >
                <View style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: 40, backgroundColor: isUp ? 'rgba(0,212,122,0.06)' : 'rgba(242,54,69,0.05)' }} />

                <Text style={{ color: C.t1, fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'], marginBottom: 10 }}>
                  {latestPrice.close.toFixed(2)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <View style={{ backgroundColor: isUp ? C.bullBg : C.bearBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ color: isUp ? C.bull : C.bear, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] }}>
                      {isUp ? '+' : ''}{latestPrice.change.toFixed(2)}{'  '}({isUp ? '+' : ''}{latestPrice.changePct.toFixed(2)}%)
                    </Text>
                  </View>
                  <Text style={{ color: C.t3, fontSize: 12 }}>today</Text>
                </View>

                {/* OHLC + Volume row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.b1, paddingTop: 14 }}>
                  <OhlcCell label="Open"   value={latestPrice.open.toFixed(2)} />
                  <OhlcCell label="High"   value={latestPrice.high.toFixed(2)} color={C.bull} />
                  <OhlcCell label="Low"    value={latestPrice.low.toFixed(2)}  color={C.bear} />
                  <OhlcCell label="Volume" value={fmtNum(latestPrice.volume)} />
                </View>
              </LinearGradient>
            )}
          </View>
        )}

        {/* Chart type toggle + range selector */}
        {chartData.length > 0 && (
          <>
            {/* Range selector */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {RANGES.map((r) => (
                  <TouchableOpacity
                    key={r.label}
                    onPress={() => setSelectedRange(r)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: selectedRange.label === r.label ? C.raised : 'transparent',
                      borderWidth: selectedRange.label === r.label ? 1 : 0,
                      borderColor: C.b2,
                    }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: selectedRange.label === r.label ? C.t1 : C.t3,
                    }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Chart */}
            <View style={{ backgroundColor: C.surface, borderRadius: 18, marginBottom: 24, borderWidth: 1, borderColor: C.b1, height: 260, ...S.card }}>
              <CartesianChart
                data={chartData}
                xKey="date"
                yKeys={['close']}
                padding={{ left: 52, right: 16, top: 16, bottom: 40 }}
                domainPadding={10}
                axisOptions={{
                  labelColor: C.t3,
                  lineColor: C.b1,
                  tickCount: 5,
                  formatXLabel: (d) => {
                    const dt = new Date(d as number);
                    return `${dt.getDate()}/${dt.getMonth() + 1}`;
                  },
                }}
              >
                {({ points }) => (
                  <Line
                    points={points.close}
                    color={C.primary}
                    strokeWidth={2.5}
                  />
                )}
              </CartesianChart>
            </View>
          </>
        )}

        {/* Fundamentals */}
        {stock && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.primary }} />
              <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15 }}>Fundamentals</Text>
            </View>
            <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b1, overflow: 'hidden', ...S.card }}>
              <FundRow label="P/E Ratio" value={stock.pe?.toFixed(2) ?? '—'} />
              <FundRow label="EPS" value={stock.eps ? `PKR ${stock.eps.toFixed(2)}` : '—'} />
              <FundRow label="Book Value" value={stock.bookValue ? `PKR ${stock.bookValue.toFixed(2)}` : '—'} last />
            </View>
          </View>
        )}

        {/* Dividend History */}
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.gold }} />
            <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15 }}>Dividend History</Text>
          </View>

          {dividends.length === 0 && (
            <Text style={{ color: C.t3, fontSize: 13 }}>No dividend history available.</Text>
          )}

          {dividends.map((d: any, i: number) => {
            const typeColor = d.type?.toLowerCase() === 'bonus' ? C.gold : d.type?.toLowerCase() === 'right' ? '#3b82f6' : C.primary;
            return (
              <View
                key={d.exDate}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: i < dividends.length - 1 ? 1 : 0,
                  borderBottomColor: '#0f1d2e',
                }}
              >
                <View>
                  <Text style={{ color: C.t1, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                    PKR {d.amount} / share
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text style={{ color: C.t2, fontSize: 12 }}>Ex: {d.exDate}</Text>
                    <View style={{ backgroundColor: `${typeColor}22`, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: typeColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                        {(d.type ?? 'CASH').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: C.t3, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                  Pay: {d.payDate}
                </Text>
              </View>
            );
          })}
        </View>

      </View>
    </ScrollView>
  );
}

function OhlcCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: C.t3, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: color ?? C.t1, fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function FundRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: last ? 0 : 1,
      borderBottomColor: '#0f1d2e',
    }}>
      <Text style={{ color: C.t2, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: C.t1, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
