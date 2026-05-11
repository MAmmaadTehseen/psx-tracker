import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { C, S } from '../lib/design';

const label = {
  color: C.t3,
  fontSize: 10,
  fontWeight: '700' as const,
  marginBottom: 8,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
};

export default function AddTradeScreen() {
  const router = useRouter();
  const { portfolioId } = useLocalSearchParams<{ portfolioId: string }>();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);

  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalValue = Number(quantity) * Number(price);
  const totalCost = totalValue + (brokerage ? Number(brokerage) : 0);
  const canSubmit = !loading && !!ticker.trim() && !!quantity && !!price
    && Number(quantity) > 0 && Number(price) > 0;

  async function handleSubmit() {
    if (!canSubmit || !portfolioId) return;
    setLoading(true);
    try {
      await api.addTrade({
        portfolioId,
        ticker: ticker.trim().toUpperCase(),
        type: tradeType,
        date,
        quantity: Number(quantity),
        pricePerShare: Number(price),
        brokerage: brokerage ? Number(brokerage) : 0,
      });
      await queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      router.back();
    } catch (err: any) {
      Alert.alert('Failed to add trade', err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (field: string) => ({
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: focused === field ? C.primary : C.b1,
    borderRadius: 14,
    ...(focused === field ? S.glow : {}),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.void }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Buy / Sell toggle */}
        <View style={{
          flexDirection: 'row', marginBottom: 24,
          borderRadius: 14, overflow: 'hidden',
          borderWidth: 1, borderColor: C.b2,
        }}>
          {(['buy', 'sell'] as const).map((t) => {
            const active = tradeType === t;
            const activeColor = t === 'buy' ? C.bull : C.bear;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTradeType(t)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 16, alignItems: 'center',
                  backgroundColor: active
                    ? (t === 'buy' ? C.bullBg : C.bearBg)
                    : C.raised,
                }}
              >
                <Text style={{
                  color: active ? activeColor : C.t3,
                  fontWeight: '700', fontSize: 15,
                  textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Ticker */}
        <View style={{ marginBottom: 16 }}>
          <Text style={label}>Ticker Symbol</Text>
          <TextInput
            style={{
              ...inputStyle('ticker'),
              color: C.t1, paddingHorizontal: 16, paddingVertical: 16,
              fontSize: 20, fontWeight: '800', letterSpacing: 2,
            }}
            placeholder="ENGRO"
            placeholderTextColor={C.t4}
            value={ticker}
            onChangeText={(v) => setTicker(v.toUpperCase())}
            onFocus={() => setFocused('ticker')}
            onBlur={() => setFocused(null)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Date */}
        <View style={{ marginBottom: 16 }}>
          <Text style={label}>Trade Date</Text>
          <TextInput
            style={{
              ...inputStyle('date'),
              color: C.t1, paddingHorizontal: 16, paddingVertical: 16,
              fontSize: 15, fontVariant: ['tabular-nums'],
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.t4}
            value={date}
            onChangeText={setDate}
            onFocus={() => setFocused('date')}
            onBlur={() => setFocused(null)}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Quantity + Price row */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={label}>Quantity</Text>
            <TextInput
              style={{
                ...inputStyle('qty'),
                color: C.t1, paddingHorizontal: 16, paddingVertical: 16,
                fontSize: 15, fontVariant: ['tabular-nums'],
              }}
              placeholder="100"
              placeholderTextColor={C.t4}
              value={quantity}
              onChangeText={setQuantity}
              onFocus={() => setFocused('qty')}
              onBlur={() => setFocused(null)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={label}>Price / Share (PKR)</Text>
            <TextInput
              style={{
                ...inputStyle('price'),
                color: C.t1, paddingHorizontal: 16, paddingVertical: 16,
                fontSize: 15, fontVariant: ['tabular-nums'],
              }}
              placeholder="450.00"
              placeholderTextColor={C.t4}
              value={price}
              onChangeText={setPrice}
              onFocus={() => setFocused('price')}
              onBlur={() => setFocused(null)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Brokerage */}
        <View style={{ marginBottom: 28 }}>
          <Text style={label}>Brokerage (PKR) · optional</Text>
          <TextInput
            style={{
              ...inputStyle('brokerage'),
              color: C.t1, paddingHorizontal: 16, paddingVertical: 16,
              fontSize: 15, fontVariant: ['tabular-nums'],
            }}
            placeholder="0"
            placeholderTextColor={C.t4}
            value={brokerage}
            onChangeText={setBrokerage}
            onFocus={() => setFocused('brokerage')}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Live summary */}
        {canSubmit && (
          <View style={{
            backgroundColor: C.surface, borderRadius: 14, padding: 16,
            marginBottom: 24, borderWidth: 1, borderColor: C.b2,
          }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              Summary
            </Text>
            <SummaryRow label="Shares" value={Number(quantity).toLocaleString('en-PK')} />
            <SummaryRow label="Price per share" value={`PKR ${Number(price).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`} />
            <SummaryRow label="Trade value" value={`PKR ${totalValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`} />
            {brokerage ? (
              <SummaryRow
                label="Total cost"
                value={`PKR ${totalCost.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`}
                highlight
              />
            ) : null}
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          style={{ borderRadius: 14, ...(canSubmit ? S.glow : {}) }}
        >
          {canSubmit ? (
            <LinearGradient
              colors={tradeType === 'buy' ? [C.primary, C.primaryDark] : ['#f23645', '#c41e2e']}
              style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                    {tradeType === 'buy' ? 'Buy' : 'Sell'} {ticker}
                  </Text>
              }
            </LinearGradient>
          ) : (
            <View style={{ borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.raised }}>
              <Text style={{ color: C.t3, fontWeight: '700', fontSize: 16 }}>Add Trade</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label: l, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: C.t2, fontSize: 13 }}>{l}</Text>
      <Text style={{ color: highlight ? C.t1 : C.t2, fontWeight: highlight ? '700' : '500', fontSize: 13, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
