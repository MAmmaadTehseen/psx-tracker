/**
 * Stock Detail Page
 *
 * Shows: candlestick/line chart, fundamentals, dividend history.
 * Route: /stock/ENGRO  (dynamic route — [ticker] in filename)
 *
 * Victory Native renders the chart. CandlestickChart needs OHLC data.
 * We transform the API response into the format Victory expects.
 */

import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  VictoryChart,
  VictoryCandlestick,
  VictoryLine,
  VictoryAxis,
  VictoryTheme,
  VictoryZoomContainer,
} from 'victory-native';
import { useState } from 'react';
import { api } from '../../lib/api';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

export default function StockDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const [selectedRange, setSelectedRange] = useState(RANGES[1]);
  const [chartType, setChartType] = useState<'candle' | 'line'>('line');

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

  const { stock, prices = [] } = stockQuery.data ?? {};
  const dividends = dividendQuery.data?.dividends ?? [];
  const latestPrice = prices[0];
  const isUp = (latestPrice?.changePct ?? 0) >= 0;

  // Transform prices to Victory's expected format (chronological order)
  const chartData = [...prices].reverse().map((p) => ({
    x: new Date(p.date),
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    y: p.close,  // needed for VictoryLine
  }));

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView className="flex-1 bg-[#0a0e1a]">
      <View className="px-4 pt-4">

        {/* Header */}
        {stock ? (
          <View className="mb-4">
            <Text className="text-gray-400 text-sm">{stock.sector}</Text>
            <Text className="text-white text-2xl font-bold">{stock.ticker}</Text>
            <Text className="text-gray-300 text-base mb-2">{stock.name}</Text>
            {latestPrice && (
              <View className="flex-row items-baseline gap-3">
                <Text className="text-white text-4xl font-bold">
                  {latestPrice.close.toFixed(2)}
                </Text>
                <Text className={`text-lg font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{latestPrice.change.toFixed(2)}{' '}
                  ({isUp ? '+' : ''}{latestPrice.changePct.toFixed(2)}%)
                </Text>
              </View>
            )}
          </View>
        ) : stockQuery.isLoading ? (
          <ActivityIndicator color="#10b981" size="large" className="mt-6 mb-4" />
        ) : null}

        {/* Chart type toggle */}
        <View className="flex-row mb-3 gap-2">
          {['line', 'candle'].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setChartType(type as 'line' | 'candle')}
              className={`px-4 py-1.5 rounded-full border ${
                chartType === type
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-transparent border-[#1f2937]'
              }`}
            >
              <Text className={chartType === type ? 'text-white font-bold text-xs' : 'text-gray-400 text-xs'}>
                {type === 'line' ? 'Line' : 'Candle'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Range selector */}
        <View className="flex-row mb-4 gap-2">
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.label}
              onPress={() => setSelectedRange(r)}
              className={`px-3 py-1.5 rounded-lg ${
                selectedRange.label === r.label ? 'bg-[#1f2937]' : ''
              }`}
            >
              <Text className={selectedRange.label === r.label ? 'text-white font-bold text-xs' : 'text-gray-500 text-xs'}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Victory Chart */}
        {chartData.length > 0 && (
          <View className="bg-[#111827] rounded-2xl mb-5 border border-[#1f2937]">
            <VictoryChart
              width={screenWidth - 32}
              height={250}
              theme={VictoryTheme.material}
              padding={{ left: 50, right: 20, top: 20, bottom: 40 }}
              containerComponent={<VictoryZoomContainer />}
              domainPadding={{ x: 10, y: 10 }}
            >
              <VictoryAxis
                style={{
                  axis: { stroke: '#374151' },
                  tickLabels: { fill: '#6b7280', fontSize: 9 },
                  grid: { stroke: 'transparent' },
                }}
                tickFormat={(t: Date) => {
                  const d = new Date(t);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                tickCount={5}
              />
              <VictoryAxis
                dependentAxis
                style={{
                  axis: { stroke: '#374151' },
                  tickLabels: { fill: '#6b7280', fontSize: 9 },
                  grid: { stroke: '#1f2937', strokeDasharray: '4' },
                }}
                tickFormat={(v: number) => v.toFixed(0)}
              />

              {chartType === 'candle' ? (
                <VictoryCandlestick
                  data={chartData}
                  candleColors={{ positive: '#10b981', negative: '#ef4444' }}
                  style={{
                    data: {
                      strokeWidth: 1,
                    },
                  }}
                />
              ) : (
                <VictoryLine
                  data={chartData}
                  style={{
                    data: { stroke: '#10b981', strokeWidth: 2 },
                  }}
                />
              )}
            </VictoryChart>
          </View>
        )}

        {/* Fundamentals */}
        {stock && (
          <View className="mb-5">
            <Text className="text-white text-base font-bold mb-3">Fundamentals</Text>
            <View className="bg-[#111827] rounded-xl border border-[#1f2937]">
              <FundRow label="P/E Ratio" value={stock.pe?.toFixed(2) ?? '—'} />
              <FundRow label="EPS" value={stock.eps ? `PKR ${stock.eps.toFixed(2)}` : '—'} />
              <FundRow label="Book Value" value={stock.bookValue ? `PKR ${stock.bookValue.toFixed(2)}` : '—'} last />
            </View>
          </View>
        )}

        {/* Dividend History */}
        <View className="mb-8">
          <Text className="text-white text-base font-bold mb-3">Dividend History</Text>
          {dividends.length === 0 && (
            <Text className="text-gray-500 text-sm">No dividend history available.</Text>
          )}
          {dividends.map((d: any) => (
            <View
              key={d.exDate}
              className="flex-row justify-between py-3 border-b border-[#1f2937]"
            >
              <View>
                <Text className="text-white text-sm font-medium">PKR {d.amount} / share</Text>
                <Text className="text-gray-500 text-xs">Ex-date: {d.exDate} · {d.type}</Text>
              </View>
              <Text className="text-gray-400 text-xs self-center">Pay: {d.payDate}</Text>
            </View>
          ))}
        </View>

      </View>
    </ScrollView>
  );
}

function FundRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between px-4 py-3 ${!last ? 'border-b border-[#1f2937]' : ''}`}>
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium">{value}</Text>
    </View>
  );
}
