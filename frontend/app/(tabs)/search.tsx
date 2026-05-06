/**
 * Search tab — find any PSX-listed stock by ticker or name.
 */

import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const { data } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.getStocks(),
    // Don't re-fetch — reuse cached data from Market tab
    staleTime: Infinity,
  });

  const stocks = data?.stocks ?? [];

  const filtered = query.length < 1
    ? stocks.slice(0, 30)
    : stocks.filter((s: any) =>
        s.ticker.includes(query.toUpperCase()) ||
        (s.name ?? '').toLowerCase().includes(query.toLowerCase())
      );

  return (
    <View className="flex-1 bg-[#0a0e1a] px-4 pt-4">
      <TextInput
        className="bg-[#111827] text-white rounded-xl px-4 py-3 mb-4 text-base border border-[#1f2937]"
        placeholder="Search ticker or company name…"
        placeholderTextColor="#6b7280"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.ticker}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            className="flex-row items-center justify-between py-3 border-b border-[#1f2937]"
            onPress={() => router.push(`/stock/${item.ticker}`)}
          >
            <View>
              <Text className="text-white font-semibold">{item.ticker}</Text>
              <Text className="text-gray-500 text-xs">{item.name ?? item.sector ?? ''}</Text>
            </View>
            <View className="items-end">
              <Text className="text-white text-sm">
                {item.close ? `PKR ${Number(item.close).toFixed(2)}` : '—'}
              </Text>
              <Text
                className={`text-xs ${(item.changePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {item.changePct != null
                  ? `${(item.changePct ?? 0) >= 0 ? '+' : ''}${Number(item.changePct).toFixed(2)}%`
                  : '—'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
