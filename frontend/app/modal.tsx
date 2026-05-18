import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, usePortfolioStore } from '../lib/store';
import { api } from '../lib/api';
import { C, S } from '../lib/design';
import { LinearGradient } from 'expo-linear-gradient';

type Status = 'idle' | 'uploading' | 'importing' | 'done' | 'error';

export default function ImportTradesModal() {
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeId = usePortfolioStore((s) => s.activePortfolioId);

  const [selectedId, setSelectedId] = useState(activeId ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{
    imported: number; skipped: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<any>(null);

  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: api.getPortfolios,
    enabled: isLoggedIn,
  });

  const portfolios = portfoliosQuery.data?.portfolios ?? [];
  const portfolioId = selectedId || portfolios[0]?.portfolioId || '';

  async function handleFile(file: File) {
    if (!portfolioId) return;
    setStatus('uploading');
    setResult(null);
    setErrorMsg('');
    try {
      const { uploadUrl, key } = await api.getUploadUrl(file.name);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'text/csv' },
      });
      if (!uploadRes.ok) throw new Error(`S3 upload failed (${uploadRes.status})`);
      setStatus('importing');
      const res = await api.importTradesCsv(portfolioId, key);
      setResult(res);
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong');
      setStatus('error');
    }
  }

  function onFileChange(e: any) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.void, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={32} color={C.t3} style={{ marginBottom: 12 }} />
        <Text style={{ color: C.t1, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
          Sign in to import trades
        </Text>
      </View>
    );
  }

  const busy = status === 'uploading' || status === 'importing';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.void }}
      contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style="light" />

      {/* Portfolio selector */}
      <Text style={{ color: C.t3, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
        Import Into
      </Text>
      {portfoliosQuery.isLoading ? (
        <View style={{ height: 38, backgroundColor: C.raised, borderRadius: 20, width: 120, marginBottom: 28 }} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {portfolios.map((p: any) => {
            const active = portfolioId === p.portfolioId;
            return (
              <TouchableOpacity
                key={p.portfolioId}
                onPress={() => setSelectedId(p.portfolioId)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? C.dim : C.raised,
                  borderWidth: 1, borderColor: active ? C.primary : C.b2,
                }}
              >
                <Text style={{ color: active ? C.primary : C.t2, fontWeight: '600', fontSize: 13 }}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* CSV format hint */}
      <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: C.b1 }}>
        <Text style={{ color: C.t2, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Expected CSV Format</Text>
        <Text style={{ color: C.t3, fontSize: 11, lineHeight: 18 }}>
          {'ticker, type, date, quantity, pricePerShare, brokerage\n'}
          {'ENGRO, buy, 2025-01-15, 100, 285.50, 120\n'}
          {'LUCK, sell, 2025-02-01, 50, 412.00, 60'}
        </Text>
        <Text style={{ color: C.t3, fontSize: 10, marginTop: 10, lineHeight: 16 }}>
          brokerage is optional · type must be buy or sell · date must be YYYY-MM-DD · max 500 rows
        </Text>
      </View>

      {/* Pick file — web only */}
      {Platform.OS === 'web' ? (
        <>
          {/* Hidden native file input — triggers OS file picker */}
          {/* @ts-ignore */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          <TouchableOpacity
            onPress={() => fileInputRef.current?.click()}
            disabled={busy || !portfolioId}
            activeOpacity={0.85}
            style={{ borderRadius: 14, marginBottom: 20, ...(portfolioId && !busy ? S.glow : {}) }}
          >
            <LinearGradient
              colors={portfolioId && !busy ? [C.primary, C.primaryDark] : [C.raised, C.raised]}
              style={{ borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {busy ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {status === 'uploading' ? 'Uploading to S3…' : 'Importing trades…'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={portfolioId ? '#fff' : C.t3} />
                  <Text style={{ color: portfolioId ? '#fff' : C.t3, fontWeight: '700', fontSize: 15 }}>
                    Pick CSV File
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : (
        <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: C.b2, alignItems: 'center', gap: 12 }}>
          <Ionicons name="desktop-outline" size={28} color={C.t3} />
          <Text style={{ color: C.t2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            CSV import is available on the web app.
          </Text>
          <Text style={{ color: C.t3, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
            Open the app in your browser to pick and upload a CSV file.
          </Text>
        </View>
      )}

      {/* Success card */}
      {status === 'done' && result && (
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.b2, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color={C.bull} />
            <Text style={{ color: C.t1, fontWeight: '700', fontSize: 16 }}>Import Complete</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: C.bullBg, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.bull, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                {result.imported}
              </Text>
              <Text style={{ color: C.bull, fontSize: 11, fontWeight: '600', marginTop: 2 }}>Imported</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.raised, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.t2, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                {result.skipped}
              </Text>
              <Text style={{ color: C.t2, fontSize: 11, fontWeight: '600', marginTop: 2 }}>Skipped</Text>
            </View>
          </View>
          {result.errors.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.t2, fontSize: 12, fontWeight: '700' }}>Row Errors</Text>
              {result.errors.map((e) => (
                <View key={e.row} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={{ color: C.bear, fontSize: 11, fontWeight: '700', width: 44 }}>Row {e.row}</Text>
                  <Text style={{ color: C.t3, fontSize: 11, flex: 1, lineHeight: 16 }}>{e.reason}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            onPress={() => { setStatus('idle'); setResult(null); }}
            style={{ paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: C.raised, borderWidth: 1, borderColor: C.b2 }}
          >
            <Text style={{ color: C.t2, fontWeight: '600', fontSize: 14 }}>Import Another File</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error card */}
      {status === 'error' && (
        <View style={{ backgroundColor: C.bearBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.bear, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="alert-circle-outline" size={18} color={C.bear} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: C.t1, fontSize: 13, lineHeight: 20 }}>{errorMsg}</Text>
            <TouchableOpacity onPress={() => setStatus('idle')}>
              <Text style={{ color: C.bear, fontSize: 12, fontWeight: '700' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
