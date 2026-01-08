'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';

import { supabase } from '../context/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';

type Role = 'owner' | 'manager' | 'staff';
type PaymentMethod = 'cash' | 'bank' | 'mixed';
type LocationFilter = 'ALL' | 'Prishtinë' | 'Fushë Kosovë';
type PaymentFilter = 'ALL' | PaymentMethod;
type DatePreset = 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'CUSTOM';

type Row = {
  id: string;
  appointment_date: string;
  client_name: string;
  phone: string | null;
  location: string | null;
  visit_notes: string | null;
  payment_method: PaymentMethod | null;
  paid_cash: number | null;
  paid_bank: number | null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDate = (date: string) => {
  const d = new Date(date);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const startOfMonth = (d: Date) => {
  const res = new Date(d.getFullYear(), d.getMonth(), 1);
  res.setHours(0, 0, 0, 0);
  return res;
};

const endOfMonth = (d: Date) => {
  const res = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  res.setHours(0, 0, 0, 0);
  return res;
};

const startOfLastMonth = (d: Date) => {
  const res = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  res.setHours(0, 0, 0, 0);
  return res;
};

const endOfLastMonth = (d: Date) => {
  const res = new Date(d.getFullYear(), d.getMonth(), 0);
  res.setHours(0, 0, 0, 0);
  return res;
};

const escapeCSV = (value: any) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export default function OwnerStatsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [role, setRole] = useState<Role>('staff');
  const [checkingRole, setCheckingRole] = useState(true);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<LocationFilter>('ALL');
  const [payment, setPayment] = useState<PaymentFilter>('ALL');

  const [datePreset, setDatePreset] = useState<DatePreset>('MONTH');

  const [startDateObj, setStartDateObj] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [endDateObj, setEndDateObj] = useState<Date>(() =>
    endOfMonth(new Date())
  );

  const startDate = toISODate(startDateObj);
  const endDate = toISODate(endDateObj);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const [totalCash, setTotalCash] = useState<number>(0);
  const [totalBank, setTotalBank] = useState<number>(0);

  const [exporting, setExporting] = useState(false);

  const debounceRef = useRef<any>(null);

  const cleanNotes = (s?: string | null) =>
  (s ?? '').replace(/\r?\n|\r/g, ' • ');

const excelSafePhone = (s?: string | null) =>
  s ? `'${s}` : '';


  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setCheckingRole(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const r = (data?.role as Role) ?? 'staff';
      setRole(r);

      if (error || r !== 'owner') {
        setCheckingRole(false);
        router.replace('/(tabs)');
        return;
      }

      setCheckingRole(false);
    })();
  }, [user]);

  const applyFilters = (q: any, forSearch: string) => {
    q = q.not('payment_method', 'is', null);

    if (forSearch.trim()) {
      const s = forSearch.trim().replace(/,/g, ' ');
      q = q.or(
        `client_name.ilike.%${s}%,phone.ilike.%${s}%,visit_notes.ilike.%${s}%`
      );
    }

    if (location !== 'ALL') q = q.eq('location', location);
    if (payment !== 'ALL') q = q.eq('payment_method', payment);
    if (startDate) q = q.gte('appointment_date', startDate);
    if (endDate) q = q.lte('appointment_date', endDate);

    return q;
  };

  const loadPage = async (forSearch: string) => {
    setLoading(true);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('appointments')
      .select(
        `id, appointment_date, client_name, phone, location, visit_notes, payment_method, paid_cash, paid_bank`,
        { count: 'exact' }
      )
      .order('appointment_date', { ascending: false })
      .range(from, to);

    query = applyFilters(query, forSearch);

    const { data, error, count } = await query;

    if (error) {
      Alert.alert('Error', error.message);
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setRows((data as Row[]) ?? []);
    setTotalCount(count ?? 0);

    setLoading(false);
  };

  const fetchAllFiltered = async (): Promise<Row[]> => {
    let all: Row[] = [];
    const chunk = 1000;
    let offset = 0;

    while (true) {
      let q = supabase
        .from('appointments')
        .select(
          `id, appointment_date, client_name, phone, location, visit_notes, payment_method, paid_cash, paid_bank`
        )
        .order('appointment_date', { ascending: false })
        .range(offset, offset + chunk - 1);

      q = applyFilters(q, search);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const part = (data as Row[]) ?? [];
      all = all.concat(part);

      if (part.length < chunk) break;
      offset += chunk;
    }

    return all;
  };

  const loadTotals = async (forSearch: string) => {
    try {
      const data = await fetchAllFiltered();

      let cash = 0;
      let bank = 0;

      for (const r of data) {
        cash += Number(r.paid_cash ?? 0);
        bank += Number(r.paid_bank ?? 0);
      }

      setTotalCash(cash);
      setTotalBank(bank);
    } catch {
      setTotalCash(0);
      setTotalBank(0);
    }
  };

  const reloadAll = async (forSearch: string) => {
    await Promise.all([loadPage(forSearch), loadTotals(forSearch)]);
  };

  useEffect(() => {
    if (checkingRole) return;
    if (role !== 'owner') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      reloadAll(search);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [role, checkingRole, search, location, payment, startDate, endDate, page]);

  useEffect(() => {
    const now = new Date();

    if (datePreset === 'TODAY') {
      setStartDateObj(now);
      setEndDateObj(now);
    }

    if (datePreset === 'MONTH') {
      setStartDateObj(startOfMonth(now));
      setEndDateObj(endOfMonth(now));
    }

    if (datePreset === 'LAST_MONTH') {
      setStartDateObj(startOfLastMonth(now));
      setEndDateObj(endOfLastMonth(now));
    }
  }, [datePreset]);

  useEffect(() => {
    setPage(1);
  }, [search, location, payment, startDate, endDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll(search);
    setRefreshing(false);
  };

  const exportCSV = async () => {
  if (exporting) return;
  setExporting(true);

  try {
    const data = await fetchAllFiltered();

    const headers = [
      'Date',
      'Client Name',
      'Phone',
      'Location',
      'Notes',
      'Payment Method',
      'Cash (€)',
      'Bank (€)',
    ];

    const lines: string[] = [];
    lines.push(headers.join(','));

    // ✅ DATA ROWS
    data.forEach((r) => {
      lines.push(
        [
          escapeCSV(formatDate(r.appointment_date)),
          escapeCSV(r.client_name),
          escapeCSV(excelSafePhone(r.phone)),
          escapeCSV(r.location ?? ''),
          escapeCSV(cleanNotes(r.visit_notes)),
          escapeCSV(r.payment_method ?? ''),
          Number(r.paid_cash ?? 0),
          Number(r.paid_bank ?? 0),
        ].join(',')
      );
    });

    // ✅ SUMMARY (ONLY ONCE)
    lines.push('');
    lines.push('SUMMARY,,,');
    lines.push(`Total Cash (€),${totalCash}`);
    lines.push(`Total Bank (€),${totalBank}`);
    lines.push(`Grand Total (€),${totalCash + totalBank}`);

    const csv = lines.join('\n');
    const filename = `owner-stats-${startDate}-to-${endDate}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      let FileSystem: any = null;
      let Sharing: any = null;

      try {
        FileSystem = await import('expo-file-system');
      } catch {}
      try {
        Sharing = await import('expo-sharing');
      } catch {}

      if (!FileSystem?.default?.writeAsStringAsync || !Sharing?.default?.shareAsync) {
        Alert.alert('Export', 'Exporti nuk është i disponueshëm.');
        setExporting(false);
        return;
      }

      const path = `${FileSystem.default.cacheDirectory}${filename}`;
      await FileSystem.default.writeAsStringAsync(path, csv, {
        encoding: FileSystem.default.EncodingType.UTF8,
      });

      await Sharing.default.shareAsync(path);
    }
  } catch (e: any) {
    Alert.alert('Export Error', e?.message ?? 'Ndodhi një gabim.');
  }

  setExporting(false);
};


  const RowCard = ({ item }: { item: Row }) => (
    <View style={[styles.card, { backgroundColor: Colors.card }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.name, { color: Colors.text }]}>
          {item.client_name}
        </Text>
        <Text style={[styles.date, { color: Colors.muted }]}>
          {formatDate(item.appointment_date)}
        </Text>
      </View>

      <Text style={[styles.line, { color: Colors.text }]}>📞 {item.phone ?? '-'}</Text>
      <Text style={[styles.line, { color: Colors.text }]}>📍 {item.location ?? '-'}</Text>
      <Text style={[styles.line, { color: Colors.text }]}>
        💳 {item.payment_method ?? '-'}
      </Text>

      <View style={styles.moneyRow}>
        <Text style={[styles.money, { color: Colors.text }]}>
          Cash: €{Number(item.paid_cash ?? 0).toFixed(2)}
        </Text>
        <Text style={[styles.money, { color: Colors.text }]}>
          Bank: €{Number(item.paid_bank ?? 0).toFixed(2)}
        </Text>
      </View>

      {item.visit_notes ? (
        <Text style={[styles.notes, { color: Colors.muted }]}>
          📝 {item.visit_notes}
        </Text>
      ) : null}
    </View>
  );
const LocationButtons = useMemo(() => {
  const opts: LocationFilter[] = ['ALL', 'Prishtinë', 'Fushë Kosovë'];

  return (
    <View style={styles.btnRow}>
      {opts.map((opt) => {
        const active = location === opt;

        return (
          <Pressable
            key={opt}
            onPress={() => setLocation(opt)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? Colors.primary : Colors.card,
              },
            ]}
          >
            <Text style={{ color: active ? '#fff' : Colors.text }}>
              {opt === 'ALL' ? 'All' : opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}, [location, Colors.primary, Colors.card, Colors.text]);

  const DatePresetButtons = useMemo(() => {
    const opts: { key: DatePreset; label: string }[] = [
      { key: 'TODAY', label: 'Today' },
      { key: 'MONTH', label: 'This month' },
      { key: 'LAST_MONTH', label: 'Last month' },
      { key: 'CUSTOM', label: 'Custom' },
    ];
    return (
      <View style={styles.btnRow}>
        {opts.map((o) => {
          const active = datePreset === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setDatePreset(o.key)}
              style={[
                styles.pill,
                { backgroundColor: active ? Colors.primary : Colors.card },
              ]}
            >
              <Text style={{ color: active ? '#fff' : Colors.text }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }, [datePreset, Colors.primary, Colors.card, Colors.text]);

  if (checkingRole) {

    


    
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (role !== 'owner') {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const headers = [
  'Date',
  'Client Name',
  'Phone',
  'Location',
  'Notes',
  'Payment Method',
  'Cash (€)',
  'Bank (€)',
];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: Colors.text }]}>Owner Stats</Text>

        <Pressable
          onPress={exportCSV}
          disabled={exporting}
          style={[styles.exportBtn, { backgroundColor: Colors.primary }]}
        >
          <Text style={styles.exportText}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search: name, phone, notes…"
        placeholderTextColor={Colors.muted}
        style={[
          styles.search,
          { borderColor: Colors.card, color: Colors.text, backgroundColor: Colors.card },
        ]}
      />

        
       <Text style={[styles.sectionTitle, { color: Colors.muted }]}>
  Location
</Text>
{LocationButtons}



      <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Date range</Text>
      {DatePresetButtons}

      {datePreset === 'CUSTOM' && (
  <View style={styles.customDates}>
    {Platform.OS === 'web' ? (
      <>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDateObj(new Date(e.target.value))}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${Colors.card}`,
            backgroundColor: Colors.card,
            color: Colors.text,
          }}
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDateObj(new Date(e.target.value))}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${Colors.card}`,
            backgroundColor: Colors.card,
            color: Colors.text,
          }}
        />
      </>
    ) : (
      <>
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={[styles.customInput, { backgroundColor: Colors.card }]}
        >
          <Text style={{ color: Colors.text }}>
            Start: {formatDate(startDate)}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowEndPicker(true)}
          style={[styles.customInput, { backgroundColor: Colors.card }]}
        >
          <Text style={{ color: Colors.text }}>
            End: {formatDate(endDate)}
          </Text>
        </Pressable>
      </>
    )}
  </View>
)}


      {showStartPicker && (
        <DateTimePicker
          value={startDateObj}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowStartPicker(false);
            if (d) setStartDateObj(d);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDateObj}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowEndPicker(false);
            if (d) setEndDateObj(d);
          }}
        />
      )}

      <View style={[styles.paginationRow, { backgroundColor: Colors.background }]}>
        <Pressable
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={[
            styles.pageBtn,
            { backgroundColor: page <= 1 ? Colors.card : Colors.primary },
          ]}
        >
          <Text style={{ color: page <= 1 ? Colors.muted : '#fff' }}>Prev</Text>
        </Pressable>

        <Text style={[styles.pageInfo, { color: Colors.text }]}>
          Page {page} / {totalPages} • {totalCount} records
        </Text>

        <Pressable
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={[
            styles.pageBtn,
            { backgroundColor: page >= totalPages ? Colors.card : Colors.primary },
          ]}
        >
          <Text style={{ color: page >= totalPages ? Colors.muted : '#fff' }}>Next</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RowCard item={item} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingBottom: 110 }}
        />
      )}

      <View style={[styles.totalsBar, { backgroundColor: Colors.card }]}>
        <View style={styles.totalsCol}>
          <Text style={[styles.totalsLabel, { color: Colors.muted }]}>
            Total Cash
          </Text>
          <Text style={[styles.totalsValue, { color: Colors.text }]}>
            €{Number(totalCash ?? 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalsCol}>
          <Text style={[styles.totalsLabel, { color: Colors.muted }]}>
            Total Bank
          </Text>
          <Text style={[styles.totalsValue, { color: Colors.text }]}>
            €{Number(totalBank ?? 0).toFixed(2)}
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[styles.homeBtn, { backgroundColor: Colors.primary }]}
        >
          <Text style={styles.homeText}>Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800' },
  exportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  exportText: { color: '#fff', fontWeight: '800' },

  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  customDates: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  customInput: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pageBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pageInfo: { fontWeight: '700' },

  card: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  name: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 12, fontWeight: '700' },
  line: { fontSize: 13, marginBottom: 4 },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  money: { fontSize: 13, fontWeight: '700' },
  notes: { marginTop: 8, fontSize: 12, fontWeight: '600' },

  totalsBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsCol: { flex: 1 },
  totalsLabel: { fontSize: 12, fontWeight: '800' },
  totalsValue: { fontSize: 15, fontWeight: '900', marginTop: 2 },

  homeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginLeft: 10,
  },
  homeText: { color: '#fff', fontWeight: '900' },
});
