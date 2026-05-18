import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Animated } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore, usePortfolioStore } from '../../lib/store';
import { signOut } from '../../lib/auth';
import { api } from '../../lib/api';
import { C, S } from '../../lib/design';
import { fmtPKR } from '../../lib/fmt';

type SortKey = 'value' | 'gain' | 'ticker';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'value',  label: 'Value'  },
  { key: 'gain',   label: 'Gain %' },
  { key: 'ticker', label: 'A–Z'    },
];

export default function PortfolioScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeId = usePortfolioStore((s) => s.activePortfolioId);
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: () => {
          signOut();
          useAuthStore.getState().setTokens(null);
          queryClient.clear();
        },
      },
    ]);
  }

  function handlePortfolioMenu(portfolioId: string, name: string) {
    Alert.alert(name, 'What would you like to do?', [
      {
        text: 'Rename',
        onPress: () => {
          setRenameTarget({ id: portfolioId, name });
          setRenameValue(name);
          setShowRenameModal(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDeletePortfolio(portfolioId, name),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleDeletePortfolio(portfolioId: string, portfolioName: string) {
    Alert.alert(
      'Delete Portfolio',
      `Delete "${portfolioName}"? All trades inside it will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await api.deletePortfolio(portfolioId);
              const remaining = (portfoliosQuery.data?.portfolios ?? [])
                .filter((p: any) => p.portfolioId !== portfolioId);
              setActivePortfolio(remaining[0]?.portfolioId ?? '');
              queryClient.invalidateQueries({ queryKey: ['portfolios'] });
              queryClient.removeQueries({ queryKey: ['portfolio', portfolioId] });
            } catch (err: any) {
              Alert.alert('Failed to delete', err.message ?? 'Unknown error');
            }
          },
        },
      ]
    );
  }

  async function handleRenamePortfolio() {
    const name = renameValue.trim();
    if (!name || !renameTarget) return;
    setRenaming(true);
    try {
      await api.renamePortfolio(renameTarget.id, name);
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setShowRenameModal(false);
      setRenameTarget(null);
    } catch (err: any) {
      Alert.alert('Failed to rename', err.message ?? 'Unknown error');
    } finally {
      setRenaming(false);
    }
  }

  async function handleCreatePortfolio() {
    const name = newPortfolioName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { portfolioId } = await api.createPortfolio(name);
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setActivePortfolio(portfolioId);
      setNewPortfolioName('');
      setShowCreateModal(false);
    } catch (err: any) {
      Alert.alert('Failed to create portfolio', err.message ?? 'Unknown error');
    } finally {
      setCreating(false);
    }
  }

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

  const deleteTradeMutation = useMutation({
    mutationFn: ({ tradeId, portfolioId }: { tradeId: string; portfolioId: string }) =>
      api.deleteTrade(tradeId, portfolioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio', activeId] }),
    onError: (err: any) => Alert.alert('Failed to delete trade', err.message ?? 'Unknown error'),
  });

  if (!isLoggedIn) {
    return (
      <LinearGradient colors={[C.void, '#060f1e', C.surface]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: C.dim, borderWidth: 1, borderColor: 'rgba(0,212,122,0.25)', ...S.glow }}>
          <Ionicons name="briefcase-outline" size={32} color={C.primary} />
        </View>
        <Text style={{ color: C.t1, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Portfolio Tracker</Text>
        <Text style={{ color: C.t2, fontSize: 14, textAlign: 'center', marginBottom: 36, lineHeight: 22 }}>
          Sign in to track your PSX holdings, P&L, and dividend income.
        </Text>
        <TouchableOpacity activeOpacity={0.85} style={{ borderRadius: 14, width: '100%', marginBottom: 12, ...S.glow }} onPress={() => router.push('/(auth)/login')}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={{ borderRadius: 14, paddingVertical: 17, alignItems: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={{ borderRadius: 14, width: '100%', paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.b2 }} onPress={() => router.push('/(auth)/register')}>
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 15 }}>Create Account</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const portfolios = portfoliosQuery.data?.portfolios ?? [];
  const holdings   = portfolioQuery.data?.holdings ?? [];
  const trades     = [...(portfolioQuery.data?.trades ?? [])]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  if (portfolios.length > 0 && !activeId) {
    setActivePortfolio(portfolios[0].portfolioId);
  }

  const sortedHoldings = [...holdings].sort((a: any, b: any) => {
    if (sortKey === 'value')  return b.currentValue - a.currentValue;
    if (sortKey === 'gain')   return (b.unrealizedGainPct ?? 0) - (a.unrealizedGainPct ?? 0);
    return a.ticker.localeCompare(b.ticker);
  });

  const totalCost         = holdings.reduce((s: number, h: any) => s + h.totalCost, 0);
  const totalValue        = holdings.reduce((s: number, h: any) => s + h.currentValue, 0);
  const totalRealizedGain = holdings.reduce((s: number, h: any) => s + (h.realizedGain ?? 0), 0);
  const totalGain         = totalValue - totalCost;
  const totalGainPct      = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const isUp              = totalGain >= 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={portfoliosQuery.isRefetching || portfolioQuery.isRefetching}
          onRefresh={() => { portfoliosQuery.refetch(); portfolioQuery.refetch(); }}
          tintColor={C.primary}
        />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 }}>

        {/* Portfolio pills + new button */}
        {portfolios.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {portfolios.map((p: any) => {
              const active = activeId === p.portfolioId;
              return active ? (
                <TouchableOpacity
                  key={p.portfolioId}
                  onPress={() => setActivePortfolio(p.portfolioId)}
                  onLongPress={() => handlePortfolioMenu(p.portfolioId, p.name)}
                  activeOpacity={0.85}
                  style={{ marginRight: 8, borderRadius: 20, ...S.glow }}
                >
                  <LinearGradient colors={[C.primary, C.primaryDark]} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{p.name}</Text>
                    <Ionicons name="ellipsis-horizontal" size={12} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={p.portfolioId}
                  onPress={() => setActivePortfolio(p.portfolioId)}
                  onLongPress={() => handlePortfolioMenu(p.portfolioId, p.name)}
                  activeOpacity={0.85}
                  style={{ marginRight: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2 }}
                >
                  <Text style={{ color: C.t2, fontWeight: '600', fontSize: 13 }}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
            {/* New portfolio button */}
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.85}
              style={{ marginRight: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="add" size={14} color={C.primary} />
              <Text style={{ color: C.primary, fontWeight: '600', fontSize: 13 }}>New</Text>
            </TouchableOpacity>
            {/* Import CSV button */}
            <TouchableOpacity
              onPress={() => router.push('/modal')}
              activeOpacity={0.85}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="cloud-upload-outline" size={14} color={C.t2} />
              <Text style={{ color: C.t2, fontWeight: '600', fontSize: 13 }}>Import</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {portfolioQuery.isLoading && (
          <View style={{ gap: 10 }}>
            {[0,1,2,3].map(i => (
              <View key={i} style={{ borderRadius: 16, backgroundColor: C.surface, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.b1 }}>
                <Skeleton h={42} w={42} r={12} />
                <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
                  <Skeleton h={14} w="60%" />
                  <Skeleton h={11} w="40%" />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Skeleton h={14} w={80} />
                  <Skeleton h={20} w={64} r={6} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Summary card */}
        {holdings.length > 0 && (
          <LinearGradient
            colors={[C.surface, C.raised]}
            style={{ borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: C.b2, overflow: 'hidden', ...S.card }}
          >
            {/* Decorative orb */}
            <View style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,212,122,0.06)' }} />

            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
              Total Value
            </Text>
            <Text style={{ color: C.t1, fontSize: 38, fontWeight: '900', fontVariant: ['tabular-nums'], marginBottom: 12 }}>
              {fmtPKR(totalValue)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name={isUp ? 'trending-up' : 'trending-down'} size={16} color={isUp ? C.bull : C.bear} />
              <View style={{ backgroundColor: isUp ? C.bullBg : C.bearBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: isUp ? C.bull : C.bear, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }}>
                  {isUp ? '+' : ''}{fmtPKR(Math.abs(totalGain))}{'  '}({isUp ? '+' : ''}{totalGainPct.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <Text style={{ color: C.t3, fontSize: 12, fontVariant: ['tabular-nums'] }}>
              Invested: {fmtPKR(totalCost)}
            </Text>
            {totalRealizedGain !== 0 && (
              <Text style={{ color: totalRealizedGain >= 0 ? C.bull : C.bear, fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                Realized: {totalRealizedGain >= 0 ? '+' : ''}{fmtPKR(Math.abs(totalRealizedGain))}
              </Text>
            )}
          </LinearGradient>
        )}

        {/* Allocation donut */}
        {holdings.length > 1 && (
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: C.t3, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              Allocation
            </Text>
            <DonutChart holdings={sortedHoldings} />
          </View>
        )}

        {/* Holdings header + sort */}
        {holdings.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.primary }} />
              <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15, flex: 1 }}>Holdings</Text>
              <Text style={{ color: C.t3, fontSize: 11, letterSpacing: 0.5 }}>
                {holdings.length} position{holdings.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {SORTS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSortKey(s.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
                    backgroundColor: sortKey === s.key ? C.dim : 'transparent',
                    borderWidth: 1,
                    borderColor: sortKey === s.key ? C.primary : C.b2,
                  }}
                >
                  <Text style={{ color: sortKey === s.key ? C.primary : C.t3, fontSize: 11, fontWeight: '600' }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {sortedHoldings.map((h: any) => (
          <HoldingRow key={h.ticker} holding={h} onPress={() => router.push(`/stock/${h.ticker}`)} />
        ))}

        {/* Empty state — no portfolios at all */}
        {portfolios.length === 0 && !portfoliosQuery.isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: C.dim }}>
              <Ionicons name="briefcase-outline" size={32} color={C.primary} />
            </View>
            <Text style={{ color: C.t1, fontWeight: '600', fontSize: 15, marginBottom: 6 }}>No portfolios yet</Text>
            <Text style={{ color: C.t2, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              Create a portfolio to start tracking your PSX holdings.
            </Text>
            <TouchableOpacity onPress={() => setShowCreateModal(true)} activeOpacity={0.85} style={{ borderRadius: 14, ...S.glow }}>
              <LinearGradient colors={[C.primary, C.primaryDark]} style={{ borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Portfolio</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty holdings (portfolio exists but no trades) */}
        {portfolios.length > 0 && holdings.length === 0 && !portfolioQuery.isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: C.dim }}>
              <Ionicons name="add-circle-outline" size={32} color={C.primary} />
            </View>
            <Text style={{ color: C.t1, fontWeight: '600', fontSize: 15, marginBottom: 6 }}>No holdings yet</Text>
            <Text style={{ color: C.t2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Tap + to add your first trade.
            </Text>
          </View>
        )}

        {/* Recent Trades */}
        {trades.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, marginRight: 10, backgroundColor: C.gold }} />
              <Text style={{ color: C.t1, fontWeight: '700', fontSize: 15, flex: 1 }}>Recent Trades</Text>
              <Text style={{ color: C.t3, fontSize: 11 }}>swipe to delete</Text>
            </View>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.b1, overflow: 'hidden', backgroundColor: C.surface, ...S.card, marginBottom: 24 }}>
              {trades.map((t: any, i: number) => (
                <TradeRow
                  key={t.tradeId}
                  trade={t}
                  isLast={i === trades.length - 1}
                  deleting={deleteTradeMutation.isPending && (deleteTradeMutation.variables as any)?.tradeId === t.tradeId}
                  onDelete={() => deleteTradeMutation.mutate({ tradeId: t.tradeId, portfolioId: t.portfolioId })}
                />
              ))}
            </View>
          </>
        )}

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 8, gap: 8 }}
        >
          <Ionicons name="log-out-outline" size={16} color={C.t3} />
          <Text style={{ color: C.t3, fontSize: 13 }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* FAB — Add Trade (absolute, floats over scroll content) */}
    {activeId && (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/add-trade', params: { portfolioId: activeId } })}
        activeOpacity={0.85}
        style={{
          position: 'absolute', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          ...S.glow,
        }}
      >
        <LinearGradient
          colors={[C.primary, C.primaryDark]}
          style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    )}

    {/* Rename Portfolio modal */}
    <Modal
      visible={showRenameModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowRenameModal(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.b2 }}>
          <Text style={{ color: C.t1, fontWeight: '800', fontSize: 18, marginBottom: 6 }}>Rename Portfolio</Text>
          <Text style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>Enter a new name</Text>
          <TextInput
            style={{ backgroundColor: C.raised, borderWidth: 1, borderColor: C.primary, borderRadius: 12, color: C.t1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 20, ...S.glow }}
            placeholderTextColor={C.t4}
            value={renameValue}
            onChangeText={setRenameValue}
            autoFocus
            maxLength={64}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => { setShowRenameModal(false); setRenameTarget(null); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2 }}
            >
              <Text style={{ color: C.t2, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRenamePortfolio}
              disabled={!renameValue.trim() || renaming}
              activeOpacity={0.85}
              style={{ flex: 1, borderRadius: 12, ...(!renameValue.trim() ? {} : S.glow) }}
            >
              <LinearGradient
                colors={renameValue.trim() ? [C.primary, C.primaryDark] : [C.raised, C.raised]}
                style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {renaming
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: renameValue.trim() ? '#fff' : C.t3, fontWeight: '700', fontSize: 15 }}>Rename</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Create Portfolio modal */}
    <Modal
      visible={showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.b2 }}>
          <Text style={{ color: C.t1, fontWeight: '800', fontSize: 18, marginBottom: 6 }}>New Portfolio</Text>
          <Text style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>Give your portfolio a name</Text>
          <TextInput
            style={{
              backgroundColor: C.raised,
              borderWidth: 1, borderColor: C.primary, borderRadius: 12,
              color: C.t1, paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 15, marginBottom: 20,
              ...S.glow,
            }}
            placeholder="e.g. Main Portfolio"
            placeholderTextColor={C.t4}
            value={newPortfolioName}
            onChangeText={setNewPortfolioName}
            autoFocus
            maxLength={64}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => { setShowCreateModal(false); setNewPortfolioName(''); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2 }}
            >
              <Text style={{ color: C.t2, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreatePortfolio}
              disabled={!newPortfolioName.trim() || creating}
              activeOpacity={0.85}
              style={{ flex: 1, borderRadius: 12, ...(!newPortfolioName.trim() ? {} : S.glow) }}
            >
              <LinearGradient
                colors={newPortfolioName.trim() ? [C.primary, C.primaryDark] : [C.raised, C.raised]}
                style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {creating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: newPortfolioName.trim() ? '#fff' : C.t3, fontWeight: '700', fontSize: 15 }}>Create</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>
  );
}

function TradeRow({ trade, isLast, deleting, onDelete }: {
  trade: any; isLast: boolean; deleting: boolean; onDelete: () => void;
}) {
  const isBuy = trade.type === 'buy';

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={onDelete}
      disabled={deleting}
      style={{
        width: 72, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.bear,
      }}
    >
      {deleting
        ? <ActivityIndicator color="#fff" />
        : <Ionicons name="trash-outline" size={20} color="#fff" />
      }
    </TouchableOpacity>
  );

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: C.surface,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#0f1d2e',
      }}>
        <View style={{
          width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
          backgroundColor: isBuy ? C.bullBg : C.bearBg,
        }}>
          <Text style={{ color: isBuy ? C.bull : C.bear, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
            {isBuy ? 'BUY' : 'SELL'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.t1, fontWeight: '600', fontSize: 14 }}>{trade.ticker}</Text>
          <Text style={{ color: C.t2, fontSize: 11, marginTop: 2 }}>
            {trade.date} · {trade.quantity} shares
          </Text>
        </View>
        <Text style={{ color: C.t1, fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'] }}>
          PKR {Number(trade.pricePerShare).toFixed(2)}
        </Text>
      </View>
    </ReanimatedSwipeable>
  );
}

function usePulse() {
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

function Skeleton({ h, w, r = 8, mb = 0 }: { h: number; w?: number | `${number}%`; r?: number; mb?: number }) {
  const opacity = usePulse();
  return <Animated.View style={{ height: h, width: w ?? '100%', borderRadius: r, backgroundColor: C.raised, opacity, marginBottom: mb }} />;
}

const PIE_COLORS = ['#00d47a','#3b82f6','#f5a623','#a855f7','#ec4899','#f97316','#06b6d4','#84cc16'];

function DonutChart({ holdings }: { holdings: any[] }) {
  const top = holdings.slice(0, 7);
  const rest = holdings.slice(7);
  const data = [
    ...top.map((h: any) => ({ label: h.ticker, value: h.currentValue })),
    ...(rest.length > 0 ? [{ label: 'Others', value: rest.reduce((s: number, h: any) => s + h.currentValue, 0) }] : []),
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  const CX = 100, CY = 100, R = 84, IR = 52;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const end = angle + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const c1 = Math.cos(angle), s1 = Math.sin(angle);
    const c2 = Math.cos(end),   s2 = Math.sin(end);
    const p = [
      `M ${CX + R * c1} ${CY + R * s1}`,
      `A ${R} ${R} 0 ${large} 1 ${CX + R * c2} ${CY + R * s2}`,
      `L ${CX + IR * c2} ${CY + IR * s2}`,
      `A ${IR} ${IR} 0 ${large} 0 ${CX + IR * c1} ${CY + IR * s1}`,
      'Z',
    ].join(' ');
    const color = PIE_COLORS[i % PIE_COLORS.length];
    angle = end;
    return { ...d, p, color, pct: (d.value / total * 100).toFixed(1) };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={200} height={200}>
        <G>{slices.map(s => <Path key={s.label} d={s.p} fill={s.color} />)}</G>
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center', paddingHorizontal: 16 }}>
        {slices.map(s => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ color: C.t2, fontSize: 10 }}>{s.label} {s.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HoldingRow({ holding, onPress }: { holding: any; onPress: () => void }) {
  const isUp = holding.unrealizedGain >= 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        borderRadius: 16, marginBottom: 10,
        borderWidth: 1, borderColor: C.b1,
        backgroundColor: C.surface,
        overflow: 'hidden',
        flexDirection: 'row',
        ...S.card,
      }}
    >
      {/* Colored left edge */}
      <View style={{ width: 4, backgroundColor: isUp ? C.bull : C.bear }} />

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: C.bullBg }}>
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
            {holding.ticker.slice(0, 4)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14 }}>{holding.ticker}</Text>
          <Text style={{ color: C.t2, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {holding.qty} shares · avg PKR {holding.avgCostPerShare.toFixed(2)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: C.t1, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }}>
            PKR {holding.currentValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </Text>
          <View style={{ marginTop: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: isUp ? C.bullBg : C.bearBg }}>
            <Text style={{ color: isUp ? C.bull : C.bear, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {isUp ? '+' : ''}{holding.unrealizedGain.toFixed(0)} ({isUp ? '+' : ''}{holding.unrealizedGainPct?.toFixed(2) ?? '0.00'}%)
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
