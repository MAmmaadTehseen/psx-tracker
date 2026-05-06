/**
 * Market Dashboard
 *
 * Shows: KSE indices, top gainers/losers, most active stocks.
 * Data is fetched from the backend API and cached by TanStack Query.
 *
 * useQuery() does three things automatically:
 *   1. Fetches data on mount
 *   2. Shows loading state while fetching
 *   3. Refetches in background when data becomes stale (every 30s per QueryClient config)
 */

import { ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';

export default function MarketScreen() {
  const router = useRouter();

  // TanStack Query — fetches /stocks and caches the result
  // queryKey identifies this cache entry — if the same key is used elsewhere,
  // they share the same cached data (no duplicate API calls)
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.getStocks(),
  });

  const stocks = data?.stocks ?? [];

  const gainers = [...stocks]
    .sort((a: any, b: any) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 10);

  const losers = [...stocks]
    .sort((a: any, b: any) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, 10);

  return (
    <ScrollView
      className="flex-1 bg-[#0a0e1a]"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#10b981" />
      }
    >
      <View className="px-4 pt-4">
        {/* Index cards */}
        <Text className="text-white text-lg font-bold mb-3">Indices</Text>
        <View className="flex-row gap-3 mb-5">
          {['KSE_100', 'KSE_30', 'KMI_30'].map((idx) => (
            <IndexCard key={idx} indexName={idx} />
          ))}
        </View>

        {isLoading && (
          <ActivityIndicator color="#10b981" size="large" className="mt-10" />
        )}

        {isError && (
          <Text className="text-red-400 text-center mt-10">
            Failed to load market data. Pull down to retry.
          </Text>
        )}

        {/* Top Gainers */}
        <Text className="text-white text-lg font-bold mb-3">Top Gainers</Text>
        <View className="mb-5">
          {gainers.map((stock: any) => (
            <StockRow
              key={stock.ticker}
              stock={stock}
              onPress={() => router.push(`/stock/${stock.ticker}`)}
            />
          ))}
        </View>

        {/* Top Losers */}
        <Text className="text-white text-lg font-bold mb-3">Top Losers</Text>
        <View className="mb-8">
          {losers.map((stock: any) => (
            <StockRow
              key={stock.ticker}
              stock={stock}
              onPress={() => router.push(`/stock/${stock.ticker}`)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function IndexCard({ indexName }: { indexName: string }) {
  const { data } = useQuery({
    queryKey: ['index', indexName],
    queryFn: () => api.getStock(`INDEX_${indexName}`, 1),
    enabled: false, // placeholder — wire up dedicated index endpoint later
  });

  const label = indexName.replace('_', '-');
  return (
    <View className="flex-1 bg-[#111827] rounded-xl p-3 border border-[#1f2937]">
      <Text className="text-gray-400 text-xs mb-1">{label}</Text>
      <Text className="text-white font-bold text-base">—</Text>
      <Text className="text-gray-500 text-xs">loading...</Text>
    </View>
  );
}

function StockRow({ stock, onPress }: { stock: any; onPress: () => void }) {
  const isUp = (stock.changePct ?? 0) >= 0;
  const changeColor = isUp ? 'text-emerald-400' : 'text-red-400';
  const sign = isUp ? '+' : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between py-3 border-b border-[#1f2937]"
    >
      <View className="flex-1">
        <Text className="text-white font-semibold">{stock.ticker}</Text>
        <Text className="text-gray-500 text-xs" numberOfLines={1}>
          {stock.name ?? stock.sector ?? ''}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-white font-medium">
          {stock.close ? `PKR ${Number(stock.close).toFixed(2)}` : '—'}
        </Text>
        <Text className={`text-xs font-semibold ${changeColor}`}>
          {stock.changePct != null
            ? `${sign}${Number(stock.changePct).toFixed(2)}%`
            : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
