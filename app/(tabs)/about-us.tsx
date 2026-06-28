import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

export default function AboutUsScreen() {
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

      <Text style={[styles.title, { color: Colors.text }]}>Rreth nesh</Text>
      <Text style={[styles.lead, { color: Colors.muted }]}>
        Fresh Look kujdeset që çdo termin, njoftim dhe shpërblim të jetë i qartë për ekipin dhe klientët.
      </Text>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.cardTitle, { color: Colors.text }]}>Qëllimi ynë</Text>
        <Text style={[styles.body, { color: Colors.muted }]}>
          Aplikacioni është ndërtuar për ta bërë punën e përditshme më të organizuar:
          terminet janë më të lehta për t'u ndjekur, klientët informohen në kohë dhe stafi ka mjetet që i duhen në një vend.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.cardTitle, { color: Colors.text }]}>Çfarë mbështet aplikacioni</Text>
        <Text style={[styles.body, { color: Colors.muted }]}>
          Menaxhim të termineve, statistika të stafit, njoftime për klientët, shpërblime me QR dhe vegla për pronarin.
          Çdo pjesë është përshtatur për përdorim të qëndrueshëm në iOS dhe Android.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.cardTitle, { color: Colors.text }]}>Standardi ynë</Text>
        <Text style={[styles.body, { color: Colors.muted }]}>
          Dizajn i pastër, gjuhë e kuptueshme në shqip dhe funksione që i shërbejnë punës reale të ekipit.
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
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
});
