import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useClientColors } from '../../components/ClientUI';

export default function ClientAboutUsScreen() {
  const Colors = useClientColors();

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace('/client/profile')}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kthehu mbrapa</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Rreth nesh</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Fresh Look është krijuar për ta bërë kujdesin personal më të lehtë, më të organizuar dhe më të afërt me klientin.
      </Text>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.cardTitle, { color: Colors.text }]}>Çfarë mund të bëni në aplikacion</Text>
        <Text style={[styles.cardBody, { color: Colors.muted }]}>
          Mund të rezervoni termine, të ndiqni vizitat tuaja, të shihni Fresh Points dhe të përditësoni të dhënat e profilit.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.cardTitle, { color: Colors.text }]}>Përvoja jonë</Text>
        <Text style={[styles.cardBody, { color: Colors.muted }]}>
          Qëllimi është që çdo klient të ketë informacion të qartë, rezervim të shpejtë dhe komunikim më të mirë me ekipin.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 120 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 15, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardBody: { fontSize: 14, lineHeight: 21 },
});
