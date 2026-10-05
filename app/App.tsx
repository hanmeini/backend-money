import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Transaction,
  TxSource,
  TxType,
  createTransaction,
  getDashboard,
  getTransactions,
  Dashboard,
} from './src/api';
import { API_BASE_URL } from './src/config';
import { getDeviceId } from './src/device';
import { configureSmsForwarder, ensureSmsPermission, flushPendingQueue } from './src/sms';

type Tab = 'dashboard' | 'tambah' | 'riwayat';

const SOURCES: TxSource[] = ['CASH', 'OVO', 'GOPAY', 'DANA', 'SHOPEEPAY', 'OTHER'];

function formatRp(n: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(n)}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [deviceId] = useState(getDeviceId);
  const [smsReady, setSmsReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nominal, setNominal] = useState('');
  const [tipe, setTipe] = useState<TxType>('EXPENSE');
  const [sumber, setSumber] = useState<TxSource>('CASH');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  const refreshDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboard(deviceId);
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard');
    }
  }, [deviceId]);

  const refreshHistory = useCallback(async () => {
    try {
      setError(null);
      const data = await getTransactions(deviceId, { month, limit: 100 });
      setHistory(data.items);
      setHistoryTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat riwayat');
    }
  }, [deviceId, month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const granted = await ensureSmsPermission();
        if (granted) {
          configureSmsForwarder(API_BASE_URL, deviceId);
          await flushPendingQueue(deviceId);
        }
        setSmsReady(granted);
      } catch {
        setSmsReady(false);
      }
      await refreshDashboard();
      setLoading(false);
    })();
  }, [deviceId, refreshDashboard]);

  useEffect(() => {
    if (tab === 'riwayat') void refreshHistory();
  }, [tab, refreshHistory]);

  const onSubmitManual = useCallback(async () => {
    const amount = Number(nominal.replace(/[^0-9]/g, ''));
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Nominal harus angka positif');
      return;
    }
    setSaving(true);
    try {
      setError(null);
      await createTransaction(deviceId, {
        amount,
        type: tipe,
        source: sumber,
        note: catatan.trim() || undefined,
      });
      setNominal('');
      setCatatan('');
      await refreshDashboard();
      setTab('dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan transaksi');
    } finally {
      setSaving(false);
    }
  }, [nominal, tipe, sumber, catatan, deviceId, refreshDashboard]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [month]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>DompetKu</Text>
        <Text style={styles.subtitle}>
          {smsReady ? 'Otomatis SMS aktif' : 'Mode manual (izin SMS belum diberikan)'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <View style={styles.body}>
          {error && <Text style={styles.error}>{error}</Text>}

          {tab === 'dashboard' && dashboard && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Sisa Uang Aman untuk Jajan</Text>
                <Text style={styles.bigNumber}>{formatRp(dashboard.sisaUangAman)}</Text>
                <Text style={styles.cardSub}>
                  {formatRp(dashboard.amanPerHari)}/hari · sisa {dashboard.sisaHari} hari (
                  {dashboard.periode})
                </Text>
              </View>
              <View style={styles.row}>
                <View style={[styles.card, styles.half]}>
                  <Text style={styles.cardLabel}>Masuk</Text>
                  <Text style={[styles.number, styles.income]}>{formatRp(dashboard.totalMasuk)}</Text>
                </View>
                <View style={[styles.card, styles.half]}>
                  <Text style={styles.cardLabel}>Keluar</Text>
                  <Text style={[styles.number, styles.expense]}>
                    {formatRp(dashboard.totalKeluar)}
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
              {dashboard.transaksiTerakhir.map((t) => (
                <TransactionRow key={t.id} tx={t} />
              ))}
              <Button title="Muat ulang" onPress={() => void refreshDashboard()} />
            </View>
          )}

          {tab === 'tambah' && (
            <View>
              <Text style={styles.sectionTitle}>Tambah Transaksi Manual</Text>
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput
                style={styles.input}
                value={nominal}
                onChangeText={setNominal}
                keyboardType="numeric"
                placeholder="mis. 25000"
              />
              <Text style={styles.label}>Jenis</Text>
              <View style={styles.row}>
                {(['EXPENSE', 'INCOME'] as TxType[]).map((t) => (
                  <Chip key={t} label={t === 'EXPENSE' ? 'Keluar' : 'Masuk'} active={tipe === t} onPress={() => setTipe(t)} />
                ))}
              </View>
              <Text style={styles.label}>Sumber Dana</Text>
              <View style={styles.chipWrap}>
                {SOURCES.map((s) => (
                  <Chip key={s} label={s} active={sumber === s} onPress={() => setSumber(s)} />
                ))}
              </View>
              <Text style={styles.label}>Catatan</Text>
              <TextInput
                style={styles.input}
                value={catatan}
                onChangeText={setCatatan}
                placeholder="mis. Kopi"
              />
              <Button title={saving ? 'Menyimpan...' : 'Simpan'} onPress={() => void onSubmitManual()} disabled={saving} />
            </View>
          )}

          {tab === 'riwayat' && (
            <View style={styles.flex}>
              <View style={styles.rowBetween}>
                <Button title="<" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
                <Text style={styles.sectionTitle}>{monthLabel}</Text>
                <Button
                  title=">"
                  onPress={() => setMonth((m) => shiftMonth(m, 1))}
                  disabled={month >= currentMonth()}
                />
              </View>
              <Text style={styles.cardSub}>Total {historyTotal} transaksi</Text>
              <FlatList
                data={history}
                keyExtractor={(t) => String(t.id)}
                renderItem={({ item }) => <TransactionRow tx={item} />}
                onRefresh={() => void refreshHistory()}
                refreshing={false}
              />
            </View>
          )}
        </View>
      )}

      <View style={styles.tabs}>
        {(
          [
            ['dashboard', 'Dompet'],
            ['tambah', 'Tambah'],
            ['riwayat', 'Riwayat'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={tab === key ? styles.tabTextActive : styles.tabText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const sign = tx.type === 'INCOME' ? '+' : '-';
  return (
    <View style={styles.txRow}>
      <View style={styles.flex}>
        <Text style={styles.txNote} numberOfLines={1}>
          {tx.note ?? tx.source}
        </Text>
        <Text style={styles.cardSub}>
          {tx.source} · {new Date(tx.occurredAt).toLocaleDateString('id-ID')}
        </Text>
      </View>
      <Text style={[styles.number, tx.type === 'INCOME' ? styles.income : styles.expense]}>
        {sign}
        {formatRp(tx.amount)}
      </Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f9' },
  header: { padding: 16, backgroundColor: '#1a73e8' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: '#d2e3fc', fontSize: 12, marginTop: 2 },
  body: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b00020', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardLabel: { fontSize: 12, color: '#5f6368' },
  cardSub: { fontSize: 12, color: '#5f6368', marginTop: 4 },
  bigNumber: { fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  number: { fontSize: 16, fontWeight: '600' },
  income: { color: '#188038' },
  expense: { color: '#b00020' },
  row: { flexDirection: 'row', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  half: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginVertical: 8 },
  label: { fontSize: 13, color: '#5f6368', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#dadce0' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e8eaed', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#202124' },
  chipTextActive: { color: '#fff' },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  txNote: { fontSize: 14, fontWeight: '500' },
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#dadce0', backgroundColor: '#fff' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderTopWidth: 2, borderTopColor: '#1a73e8' },
  tabText: { color: '#5f6368' },
  tabTextActive: { color: '#1a73e8', fontWeight: 'bold' },
});
