import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useClientColors } from '../../components/ClientUI';

export default function ClientOrderSuccessScreen() {
  const Colors = useClientColors();
  const { orderId, total } = useLocalSearchParams<{ orderId?: string; total?: string }>();

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.primarySoft }]}>
          <Ionicons name="checkmark" size={34} color={Colors.primary} />
        </View>
        <Text style={[styles.title, { color: Colors.text }]}>Porosia u krye</Text>
        <Text style={[styles.subtitle, { color: Colors.muted }]}>
          Faleminderit. Porosia juaj është regjistruar me sukses dhe ekipi do ta përgatisë për dorëzim.
        </Text>

        {!!orderId && (
          <View style={[styles.detailBox, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.detailLabel, { color: Colors.muted }]}>Kodi i porosisë</Text>
            <Text style={[styles.detailValue, { color: Colors.text }]}>{orderId}</Text>
          </View>
        )}

        {!!total && (
          <View style={[styles.detailBox, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.detailLabel, { color: Colors.muted }]}>Totali</Text>
            <Text style={[styles.detailValue, { color: Colors.primary }]}>{total}€</Text>
          </View>
        )}

        <Pressable style={[styles.primaryButton, { backgroundColor: Colors.primary }]} onPress={() => router.replace('/client/shop')}>
          <Text style={styles.primaryText}>Vazhdo te produktet</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, { borderColor: Colors.border }]} onPress={() => router.replace('/client')}>
          <Text style={[styles.secondaryText, { color: Colors.text }]}>Kthehu në kryefaqe</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingBottom: 140 },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, alignItems: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  detailBox: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  detailLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  primaryButton: { width: '100%', minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondaryButton: { width: '100%', minHeight: 54, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { fontSize: 15, fontWeight: '900' },
});
