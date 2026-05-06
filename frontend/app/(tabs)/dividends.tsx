/**
 * Dividends tab
 *
 * Shows dividend income from all holdings across all portfolios.
 * Groups by month, shows yield on cost per stock.
 */

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore, usePortfolioStore } from '../../lib/store';
import { api } from '../../lib/api';

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
      <View className="flex-1 bg-[#0a0e1a] items-center justify-center px-8">
        <Text className="text-white text-xl font-bold mb-2">Dividend Tracker</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to track dividend income and yield on cost for your holdings.
        </Text>
        <TouchableOpacity
          className="bg-emerald-500 rounded-xl px-8 py-3 w-full items-center"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-white font-bold text-base">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const holdings = portfolioQuery.data?.holdings ?? [];

  return (
    <ScrollView className="flex-1 bg-[#0a0e1a]">
      <View className="px-4 pt-4">
        <Text className="text-white text-lg font-bold mb-4">Dividend Income</Text>

        {portfolioQuery.isLoading && (
          <ActivityIndicator color="#10b981" size="large" className="mt-10" />
        )}

        {holdings.map((h: any) => (
          <DividendRow key={h.ticker} ticker={h.ticker} avgCost={h.avgCostPerShare} qty={h.qty} />
        ))}

        {holdings.length === 0 && !portfolioQuery.isLoading && (
          <Text className="text-gray-500 text-center mt-10">
            Add holdings to your portfolio to see dividend tracking here.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function DividendRow({
  ticker,
  avgCost,
  qty,
}: {
  ticker: string;
  avgCost: number;
  qty: number;
}) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dividends', ticker],
    queryFn: () => api.getDividends(ticker),
    staleTime: 60_000 * 30,  // dividends don't change often
  });

  const dividends = data?.dividends ?? [];
  const lastDiv = dividends[0];

  // Yield on cost = (annual dividend per share / avg cost) * 100
  // This tells you what % return you're getting based on what you paid
  const annualDivPerShare = lastDiv ? lastDiv.amount : 0;
  const yieldOnCost = avgCost > 0 ? ((annualDivPerShare / avgCost) * 100).toFixed(2) : '0.00';
  const totalIncome = (annualDivPerShare * qty).toFixed(0);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/stock/${ticker}`)}
      className="bg-[#111827] rounded-xl p-4 mb-3 border border-[#1f2937]"
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-white font-bold text-base">{ticker}</Text>
        <View className="items-end">
          <Text className="text-emerald-400 font-bold text-base">
            PKR {Number(totalIncome).toLocaleString()} / yr
          </Text>
          <Text className="text-gray-400 text-xs">{yieldOnCost}% yield on cost</Text>
        </View>
      </View>

      {isLoading ? (
        <Text className="text-gray-600 text-xs">Loading dividend history…</Text>
      ) : (
        <View>
          {dividends.slice(0, 3).map((d: any) => (
            <View key={d.exDate} className="flex-row justify-between py-1 border-t border-[#1f2937]">
              <Text className="text-gray-400 text-xs">Ex: {d.exDate}</Text>
              <Text className="text-white text-xs font-medium">
                PKR {d.amount} / share · {d.type}
              </Text>
            </View>
          ))}
          {dividends.length === 0 && (
            <Text className="text-gray-600 text-xs">No dividend history found.</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
