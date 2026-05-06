/**
 * Portfolio tab
 *
 * Shows holdings with P&L for the active portfolio.
 * Redirects to login if not authenticated.
 */

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore, usePortfolioStore } from '../../lib/store';
import { api } from '../../lib/api';

export default function PortfolioScreen() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeId = usePortfolioStore((s) => s.activePortfolioId);
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio);

  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: api.getPortfolios,
    enabled: isLoggedIn,
  });

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', activeId],
    queryFn: () => api.getPortfolio(activeId!),
    enabled: isLoggedIn && !!activeId,
  });

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-[#0a0e1a] items-center justify-center px-8">
        <Text className="text-white text-xl font-bold mb-2">Portfolio Tracker</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to track your PSX holdings, P&L, and dividend income.
        </Text>
        <TouchableOpacity
          className="bg-emerald-500 rounded-xl px-8 py-3 w-full items-center"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-white font-bold text-base">Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mt-3 w-full items-center py-3"
          onPress={() => router.push('/(auth)/register')}
        >
          <Text className="text-emerald-400 font-medium">Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const portfolios = portfoliosQuery.data?.portfolios ?? [];
  const holdings = portfolioQuery.data?.holdings ?? [];

  // Auto-select first portfolio
  if (portfolios.length > 0 && !activeId) {
    setActivePortfolio(portfolios[0].portfolioId);
  }

  const totalCost = holdings.reduce((s: number, h: any) => s + h.totalCost, 0);
  const totalValue = holdings.reduce((s: number, h: any) => s + h.currentValue, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const isUp = totalGain >= 0;

  return (
    <ScrollView className="flex-1 bg-[#0a0e1a]">
      <View className="px-4 pt-4">

        {/* Portfolio selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {portfolios.map((p: any) => (
            <TouchableOpacity
              key={p.portfolioId}
              onPress={() => setActivePortfolio(p.portfolioId)}
              className={`mr-2 px-4 py-2 rounded-full border ${
                activeId === p.portfolioId
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-[#111827] border-[#1f2937]'
              }`}
            >
              <Text className={activeId === p.portfolioId ? 'text-white font-bold' : 'text-gray-300'}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {portfolioQuery.isLoading && (
          <ActivityIndicator color="#10b981" size="large" className="mt-10" />
        )}

        {/* Summary card */}
        {holdings.length > 0 && (
          <View className="bg-[#111827] rounded-2xl p-4 mb-5 border border-[#1f2937]">
            <Text className="text-gray-400 text-sm mb-1">Total Value</Text>
            <Text className="text-white text-3xl font-bold">
              PKR {totalValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className={`text-base font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? '▲' : '▼'}{' '}
                PKR {Math.abs(totalGain).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                {' '}({isUp ? '+' : ''}{totalGainPct.toFixed(2)}%)
              </Text>
            </View>
            <Text className="text-gray-500 text-xs mt-1">
              Invested: PKR {totalCost.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        )}

        {/* Holdings list */}
        <Text className="text-white text-base font-bold mb-3">Holdings</Text>
        {holdings.map((h: any) => (
          <HoldingRow key={h.ticker} holding={h} onPress={() => router.push(`/stock/${h.ticker}`)} />
        ))}

        {holdings.length === 0 && !portfolioQuery.isLoading && (
          <Text className="text-gray-500 text-center mt-10">
            No holdings yet. Add a trade to get started.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function HoldingRow({ holding, onPress }: { holding: any; onPress: () => void }) {
  const isUp = holding.unrealizedGain >= 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#111827] rounded-xl p-4 mb-2 border border-[#1f2937]"
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-white font-bold text-base">{holding.ticker}</Text>
          <Text className="text-gray-500 text-xs">{holding.qty} shares · avg PKR {holding.avgCostPerShare.toFixed(2)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-white font-semibold">
            PKR {holding.currentValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </Text>
          <Text className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{holding.unrealizedGain.toFixed(0)} ({isUp ? '+' : ''}{holding.unrealizedGainPct.toFixed(2)}%)
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
