import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Transaction,
  TxSource,
  TxType,
  createTransaction,
  deleteTransaction,
  getDashboard,
  getTransactions,
  updateTransaction,
  Dashboard,
} from './src/api';
import { API_BASE_URL } from './src/config';
import { getDeviceId } from './src/device';
import { configureSmsForwarder, ensureSmsPermission, flushPendingQueue } from './src/sms';

type Tab = 'dashboard' | 'tambah' | 'riwayat';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BLUE = '#007AFF';
const GREEN = '#34C759';
const RED = '#FF3B30';
const BG = '#F2F2F7';
const CARD = '#FFFFFF';
const LABEL = '#000000';
const SECONDARY = '#8E8E93';
const SEPARATOR = '#E5E5EA';

const SOURCES: TxSource[] = ['CASH', 'OVO', 'GOPAY', 'DANA', 'SHOPEEPAY', 'OTHER'];

const TABS: { key: Tab; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'dashboard', label: 'Dompet', icon: 'wallet-outline', iconActive: 'wallet' },
  { key: 'tambah', label: 'Tambah', icon: 'add-circle-outline', iconActive: 'add-circle' },
  { key: 'riwayat', label: 'Riwayat', icon: 'receipt-outline', iconActive: 'receipt' },
];

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

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editTipe, setEditTipe] = useState<TxType>('EXPENSE');
  const [editSumber, setEditSumber] = useState<TxSource>('CASH');
  const [editCatatan, setEditCatatan] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  const openEditor = useCallback((tx: Transaction) => {
    setEditing(tx);
    setEditNominal(String(tx.amount));
    setEditTipe(tx.type);
    setEditSumber(tx.source);
    setEditCatatan(tx.note ?? '');
    setError(null);
  }, []);

  const onSaveEdit = useCallback(async () => {
    if (!editing) return;
    const amount = Number(editNominal.replace(/[^0-9]/g, ''));
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Nominal harus angka positif');
      return;
    }
    setEditSaving(true);
    try {
      setError(null);
      await updateTransaction(deviceId, editing.id, {
        amount,
        type: editTipe,
        source: editSumber,
        note: editCatatan.trim() || undefined,
      });
      setEditing(null);
      await refreshDashboard();
      await refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan perubahan');
    } finally {
      setEditSaving(false);
    }
  }, [editing, editNominal, editTipe, editSumber, editCatatan, deviceId, refreshDashboard, refreshHistory]);

  const onDeleteTx = useCallback(() => {
    if (!editing) return;
    const id = editing.id;
    Alert.alert('Hapus transaksi?', 'Data yang dihapus tidak bisa dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          (async () => {
            try {
              setError(null);
              await deleteTransaction(deviceId, id);
              setEditing(null);
              await refreshDashboard();
              await refreshHistory();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Gagal menghapus transaksi');
            }
          })();
        },
      },
    ]);
  }, [editing, deviceId, refreshDashboard, refreshHistory]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [month]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        <StatusPill active={smsReady} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={BLUE} />
          </View>
        ) : (
          <>
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {tab === 'dashboard' && dashboard && (
              <FlatList
                data={dashboard.transaksiTerakhir}
                keyExtractor={(t) => String(t.id)}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <>
                    <Text style={styles.largeTitle}>Dompet</Text>
                    <View style={styles.heroCard}>
                      <Text style={styles.heroLabel}>SISA UANG AMAN UNTUK JAJAN</Text>
                      <Text style={styles.heroNumber}>{formatRp(dashboard.sisaUangAman)}</Text>
                      <View style={styles.heroSubRow}>
                        <Ionicons name="calendar-outline" size={13} color="#FFFFFFCC" />
                        <Text style={styles.heroSub}>
                          {formatRp(dashboard.amanPerHari)}/hari · sisa {dashboard.sisaHari} hari
                        </Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={[styles.card, styles.half]}>
                        <View style={styles.miniRow}>
                          <View style={[styles.dot, { backgroundColor: GREEN }]} />
                          <Text style={styles.cardLabel}>Masuk</Text>
                        </View>
                        <Text style={[styles.number, { color: GREEN }]}>
                          {formatRp(dashboard.totalMasuk)}
                        </Text>
                        <Text style={styles.cardSub}>{dashboard.periode}</Text>
                      </View>
                      <View style={[styles.card, styles.half]}>
                        <View style={styles.miniRow}>
                          <View style={[styles.dot, { backgroundColor: RED }]} />
                          <Text style={styles.cardLabel}>Keluar</Text>
                        </View>
                        <Text style={[styles.number, { color: RED }]}>
                          {formatRp(dashboard.totalKeluar)}
                        </Text>
                        <Text style={styles.cardSub}>{dashboard.periode}</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionTitle}>Terakhir</Text>
                  </>
                }
                renderItem={({ item }) => <TransactionRow tx={item} onPress={() => openEditor(item)} />}
              />
            )}

            {tab === 'tambah' && (
              <FlatList
                data={[]}
                renderItem={null}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <>
                    <Text style={styles.largeTitle}>Tambah</Text>
                    <View style={styles.card}>
                      <Text style={styles.groupLabel}>NOMINAL</Text>
                      <View style={styles.amountRow}>
                        <Text style={styles.rpPrefix}>Rp</Text>
                        <TextInput
                          style={styles.amountInput}
                          value={nominal}
                          onChangeText={setNominal}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={SECONDARY}
                        />
                      </View>
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.groupLabel}>JENIS</Text>
                      <View style={styles.segment}>
                        {(['EXPENSE', 'INCOME'] as TxType[]).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.segmentItem, tipe === t && styles.segmentActive]}
                            onPress={() => setTipe(t)}>
                            <Ionicons
                              name={t === 'EXPENSE' ? 'arrow-up-circle' : 'arrow-down-circle'}
                              size={16}
                              color={tipe === t ? LABEL : SECONDARY}
                            />
                            <Text style={[styles.segmentText, tipe === t && styles.segmentTextActive]}>
                              {t === 'EXPENSE' ? 'Keluar' : 'Masuk'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.groupLabel}>SUMBER DANA</Text>
                      <View style={styles.chipWrap}>
                        {SOURCES.map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.sourceChip, sumber === s && styles.sourceChipActive]}
                            onPress={() => setSumber(s)}>
                            <Text
                              style={[
                                styles.sourceChipText,
                                sumber === s && styles.sourceChipTextActive,
                              ]}>
                              {s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.groupLabel}>CATATAN</Text>
                      <TextInput
                        style={styles.noteInput}
                        value={catatan}
                        onChangeText={setCatatan}
                        placeholder="mis. Kopi susu"
                        placeholderTextColor={SECONDARY}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
                      onPress={() => void onSubmitManual()}
                      disabled={saving}>
                      <Text style={styles.primaryButtonText}>
                        {saving ? 'Menyimpan…' : 'Simpan Transaksi'}
                      </Text>
                    </TouchableOpacity>
                  </>
                }
              />
            )}

            {tab === 'riwayat' && (
              <View style={styles.flex}>
                <Text style={styles.largeTitle}>Riwayat</Text>
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <StepperButton
                      icon="chevron-back"
                      onPress={() => setMonth((m) => shiftMonth(m, -1))}
                    />
                    <View style={styles.center}>
                      <Text style={styles.monthLabel}>{monthLabel}</Text>
                      <Text style={styles.cardSub}>{historyTotal} transaksi</Text>
                    </View>
                    <StepperButton
                      icon="chevron-forward"
                      onPress={() => setMonth((m) => shiftMonth(m, 1))}
                      disabled={month >= currentMonth()}
                    />
                  </View>
                </View>
                <FlatList
                  data={history}
                  keyExtractor={(t) => String(t.id)}
                  renderItem={({ item }) => <TransactionRow tx={item} onPress={() => openEditor(item)} />}
                  onRefresh={() => void refreshHistory()}
                  refreshing={false}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
          </>
        )}
      </View>

      <Modal visible={editing !== null} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Ubah Transaksi</Text>

            <Text style={styles.groupLabel}>NOMINAL</Text>
            <View style={styles.amountRow}>
              <Text style={styles.rpPrefix}>Rp</Text>
              <TextInput
                style={styles.amountInput}
                value={editNominal}
                onChangeText={setEditNominal}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={SECONDARY}
              />
            </View>

            <Text style={styles.groupLabel}>JENIS</Text>
            <View style={styles.segment}>
              {(['EXPENSE', 'INCOME'] as TxType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segmentItem, editTipe === t && styles.segmentActive]}
                  onPress={() => setEditTipe(t)}>
                  <Text style={[styles.segmentText, editTipe === t && styles.segmentTextActive]}>
                    {t === 'EXPENSE' ? 'Keluar' : 'Masuk'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.groupLabel}>SUMBER DANA</Text>
            <View style={styles.chipWrap}>
              {SOURCES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sourceChip, editSumber === s && styles.sourceChipActive]}
                  onPress={() => setEditSumber(s)}>
                  <Text style={[styles.sourceChipText, editSumber === s && styles.sourceChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.groupLabel}>CATATAN</Text>
            <TextInput
              style={styles.noteInput}
              value={editCatatan}
              onChangeText={setEditCatatan}
              placeholder="mis. Kopi susu"
              placeholderTextColor={SECONDARY}
            />

            <TouchableOpacity
              style={[styles.primaryButton, editSaving && styles.primaryButtonDisabled]}
              onPress={() => void onSaveEdit()}
              disabled={editSaving}>
              <Text style={styles.primaryButtonText}>{editSaving ? 'Menyimpan…' : 'Simpan Perubahan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onDeleteTx}>
              <Ionicons name="trash-outline" size={16} color={RED} />
              <Text style={styles.deleteButtonText}>Hapus Transaksi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(null)}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
              <Ionicons name={active ? t.iconActive : t.icon} size={24} color={active ? BLUE : SECONDARY} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <View style={[styles.pill, active ? styles.pillOn : styles.pillOff]}>
      <View style={[styles.pillDot, { backgroundColor: active ? GREEN : SECONDARY }]} />
      <Text style={styles.pillText}>
        {active ? 'Sinkron SMS otomatis aktif' : 'Mode manual · izinkan akses SMS'}
      </Text>
    </View>
  );
}

function StepperButton({
  icon,
  onPress,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.stepper, disabled && styles.stepperDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <Ionicons name={icon} size={18} color={disabled ? SEPARATOR : BLUE} />
    </TouchableOpacity>
  );
}

function TransactionRow({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const isIn = tx.type === 'INCOME';
  const sign = isIn ? '+' : '−';
  return (
    <TouchableOpacity style={styles.txRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.txIcon, { backgroundColor: isIn ? '#E5F9EC' : '#FDECEC' }]}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={18}
          color={isIn ? GREEN : RED}
        />
      </View>
      <View style={styles.flex}>
        <Text style={styles.txNote} numberOfLines={1}>
          {tx.note ?? tx.source}
        </Text>
        <Text style={styles.txMeta}>
          {tx.source} · {new Date(tx.occurredAt).toLocaleDateString('id-ID')}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? GREEN : LABEL }]}>
        {sign}
        {formatRp(tx.amount)}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={SECONDARY} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  largeTitle: { fontSize: 34, fontWeight: '700', color: LABEL, marginTop: 4, marginBottom: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
  },
  pillOn: { backgroundColor: '#E5F9EC' },
  pillOff: { backgroundColor: '#E9E9EE' },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: 12, color: LABEL, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  errorText: { color: RED, fontSize: 13, flex: 1 },
  heroCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  heroLabel: { color: '#FFFFFF99', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  heroNumber: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 6 },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 5 },
  heroSub: { color: '#FFFFFFCC', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  half: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 13, color: SECONDARY },
  cardSub: { fontSize: 12, color: SECONDARY, marginTop: 4 },
  number: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: LABEL, marginTop: 4, marginBottom: 8 },
  groupLabel: { fontSize: 11, fontWeight: '600', color: SECONDARY, letterSpacing: 0.8, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rpPrefix: { fontSize: 22, fontWeight: '600', color: SECONDARY, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: LABEL, paddingVertical: 2 },
  noteInput: { fontSize: 16, color: LABEL, paddingVertical: 4 },
  segment: { flexDirection: 'row', backgroundColor: '#E5E5EA', borderRadius: 9, padding: 2 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    gap: 6,
  },
  segmentActive: { backgroundColor: CARD, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '500', color: SECONDARY },
  segmentTextActive: { color: LABEL, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#EFEFF4' },
  sourceChipActive: { backgroundColor: BLUE },
  sourceChipText: { fontSize: 13, fontWeight: '600', color: LABEL },
  sourceChipTextActive: { color: '#FFFFFF' },
  primaryButton: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 24 },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: LABEL, textTransform: 'capitalize' },
  stepper: { backgroundColor: '#EFEFF4', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperDisabled: { opacity: 0.5 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  txNote: { fontSize: 15, fontWeight: '500', color: LABEL },
  txMeta: { fontSize: 12, color: SECONDARY, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFFF2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEPARATOR,
    paddingBottom: 20,
    paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10, color: SECONDARY, fontWeight: '500' },
  tabLabelActive: { color: BLUE, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: { backgroundColor: BG, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: SEPARATOR, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: LABEL, marginBottom: 12 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  deleteButtonText: { color: RED, fontSize: 16, fontWeight: '600' },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelButtonText: { color: BLUE, fontSize: 16, fontWeight: '500' },
});
