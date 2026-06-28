import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

const helpTopics = [
  {
    title: 'Skanimi i QR',
    body: 'Hapni kamerën nga “Përdor shpërblim QR”, skanoni kodin e klientit dhe konfirmoni vetëm pasi të shihni të dhënat e sakta.',
  },
  {
    title: 'Terminet',
    body: 'Përdorni kalendarin dhe listën “Në ardhje” për të parë oraret. Pronarët mund të menaxhojnë terminet nga profili.',
  },
  {
    title: 'Njoftimet',
    body: 'Nga “Dërgo njoftime” mund të përgatitni mesazhe për klientët në iOS dhe Android. Mbajini mesazhet të shkurtra dhe të qarta.',
  },
  {
    title: 'Llogaria dhe siguria',
    body: 'Fjalëkalimin mund ta ndryshoni nga profili. Për veprime më të ndjeshme, shkoni te “Menaxho profilin”.',
  },
];

export default function HelpCenterScreen() {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
    >
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.backText, { color: Colors.primary }]}>Kthehu</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Qendra e ndihmës</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Udhëzime të shkurtra për veprimet që përdoren më shpesh nga stafi.
      </Text>

      {helpTopics.map((topic) => (
        <View
          key={topic.title}
          style={[styles.topicCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}
        >
          <Text style={[styles.topicTitle, { color: Colors.text }]}>{topic.title}</Text>
          <Text style={[styles.topicBody, { color: Colors.muted }]}>{topic.body}</Text>
        </View>
      ))}

      <View style={[styles.supportCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.topicTitle, { color: Colors.text }]}>Kur diçka nuk duket në rregull</Text>
        <Text style={[styles.topicBody, { color: Colors.muted }]}>
          Rifreskoni aplikacionin nga butoni në krye. Nëse problemi vazhdon, dilni nga llogaria dhe hyni përsëri.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 120,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  topicCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  supportCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  topicBody: {
    fontSize: 14,
    lineHeight: 21,
  },
});
