import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useClientColors } from '../../components/ClientUI';

const topics = [
  {
    title: 'Rezervimi i terminit',
    body: 'Zgjidhni shërbimin, datën dhe orarin nga “Rezervo”. Pas krijimit të terminit, ai shfaqet te vizitat tuaja.',
  },
  {
    title: 'Fresh Points',
    body: 'Pikët ruhen në profilin tuaj dhe mund të përdoren për shpërblime kur oferta është aktive.',
  },
  {
    title: 'Ndryshimi i të dhënave',
    body: 'Te “Menaxho profilin” mund të përditësoni emrin, numrin e telefonit dhe foton e profilit.',
  },
  {
    title: 'Siguria',
    body: 'Ndryshoni fjalëkalimin nëse mendoni se dikush tjetër ka qasje në llogarinë tuaj.',
  },
];

export default function ClientHelpCenterScreen() {
  const Colors = useClientColors();

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace('/client/profile')}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kthehu mbrapa</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Qendra e ndihmës</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Përgjigje të shkurtra për veprimet kryesore në aplikacion.
      </Text>

      {topics.map((topic) => (
        <View key={topic.title} style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          <Text style={[styles.cardTitle, { color: Colors.text }]}>{topic.title}</Text>
          <Text style={[styles.cardBody, { color: Colors.muted }]}>{topic.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 120 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 15, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardBody: { fontSize: 14, lineHeight: 21 },
});
