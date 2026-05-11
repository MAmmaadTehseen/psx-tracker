import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import { C, S } from '../../lib/design';

export default function WatchlistScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    enabled: isLoggedIn,
  });

  const stocksQuery = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.getStocks(),
    enabled: isLoggedIn,
  });

  const removeMutation = useMutation({
    mutationFn: (ticker: string) => api.removeFromWatchlist(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const isRefreshing = watchlistQuery.isRefetching || stocksQuery.isRefetching;

  function handleRefresh() {
    watchlistQuery.refetch();
    stocksQuery.refetch();
  }

  if (!isLoggedIn) {
    return (
      <LinearGradient
        colors={[C.void, '#060f1e', C.surface]}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        <View style={{
          width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, backgroundColor: C.dim, borderWidth: 1,
          borderColor: 'rgba(0,212,122,0.25)', ...S.glow,
        }}>
          <Ionicons name="bookmark-outline" size={32} color={C.primary} />
        </View>
        <Text style={{ color: C.t1, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
          Watchlist
        </Text>
        <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', marginBottom: 36, lineHeight: 22 }}>
          Sign in to track stocks you're watching.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={{ borderRadius: 14, width: '100%', marginBottom: 12, ...S.glow }}
          onPress={() => router.push('/(auth)/login')}
        >
          <LinearGradient
            colors={[C.primary, C.primaryDark]}
            style={{ borderRadius: 14, paddingVertical: 17, alignItems: 'center' }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={{ borderRadius: 14, width: '100%', paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.b2 }}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 15 }}>Create Account</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const tickers = watchlistQuery.data?.tickers ?? [];
  const allStocks = stocksQuery.data?.stocks ?? [];
  const watchedStocks = tickers
    .map(t => allStocks.find((s: any) => s.ticker === t))
    .filter(Boolean) as any[];

  const isLoading = watchlistQuery.isLoading || stocksQuery.isLoading;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.void }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={C.primary} />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.primary }} />
          <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15, flex: 1 }}>Watching</Text>
          <Text style={{ color: C.t3, fontSize: 12 }}>{tickers.length} stock{tickers.length !== 1 ? 's' : ''}</Text>
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={{ color: C.t2, fontSize: 13, marginTop: 12 }}>Loading watchlist…</Text>
          </View>
        )}

        {!isLoading && tickers.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 56 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.surface, borderWidth: 1, borderColor: C.b1, marginBottom: 20,
            }}>
              <Ionicons name="bookmark-outline" size={34} color={C.t3} />
            </View>
            <Text style={{ color: C.t1, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Nothing yet</Text>
            <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              Tap the bookmark icon on any stock{'\n'}to add it to your watchlist.
            </Text>
          </View>
        )}

        {!isLoading && watchedStocks.length > 0 && (
          <View style={{
            borderRadius: 18, borderWidth: 1, borderColor: C.b1,
            overflow: 'hidden', backgroundColor: C.surface, ...S.card,
          }}>
            {watchedStocks.map((stock, i) => (
              <WatchRow
                key={stock.ticker}
                stock={stock}
                isLast={i === watchedStocks.length - 1}
                removing={removeMutation.isPending && removeMutation.variables === stock.ticker}
                onPress={() => router.push(`/stock/${stock.ticker}`)}
                onRemove={() => removeMutation.mutate(stock.ticker)}
              />
            ))}
          </View>
        )}

        {/* Tickers in watchlist but not yet in stocks cache */}
        {!isLoading && tickers.length > 0 && watchedStocks.length < tickers.length && (
          <Text style={{ color: C.t3, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            {tickers.length - watchedStocks.length} ticker{tickers.length - watchedStocks.length !== 1 ? 's' : ''} pending market data
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function WatchRow({
  stock, isLast, removing, onPress, onRemove,
}: {
  stock: any;
  isLast: boolean;
  removing: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
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
      <View style={{
        width: 42, height: 42, borderRadius: 12, alignItems: 'center',
        justifyContent: 'center', marginRight: 12,
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

      <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
        <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }}>
          {stock.close ? Number(stock.close).toFixed(2) : '—'}
        </Text>
        <View style={{
          marginTop: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
          backgroundColor: isUp ? C.bullBg : C.bearBg,
        }}>
          <Text style={{ color: isUp ? C.bull : C.bear, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {stock.changePct != null ? `${sign}${Number(stock.changePct).toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onRemove}
        disabled={removing}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {removing
          ? <ActivityIndicator size="small" color={C.t3} />
          : <Ionicons name="bookmark" size={18} color={C.primary} />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
