import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';
import { supabase } from '../../context/supabase';

export default function NotificationsScreen() {
  const { profile, loading } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (loading) return null;
  if (profile?.role !== 'owner') return <Redirect href="/(tabs)/profile" />;

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Shtoni titullin dhe mesazhin.');
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { title: title.trim(), message: message.trim() },
    });
    setSending(false);

    if (error) {
      Alert.alert('Njoftimi nuk u dërgua', error.message);
      return;
    }

    Alert.alert('Njoftimi u dërgua', `U dërgua në ${data?.sent ?? 0} pajisje të regjistruara.`);
    setTitle('');
    setMessage('');
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Profili</Text>
      </Pressable>
      <Text style={[styles.title, { color: Colors.text }]}>Dërgo njoftim</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>Dërgoni një mesazh te pajisjet e regjistruara iOS dhe Android.</Text>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}> 
        <TextInput
          style={[styles.input, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.text }]}
          placeholder="Titulli i njoftimit"
          placeholderTextColor={Colors.muted}
          maxLength={80}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.message, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.text }]}
          placeholder="Mesazhi"
          placeholderTextColor={Colors.muted}
          maxLength={500}
          multiline
          value={message}
          onChangeText={setMessage}
        />
        <Pressable style={[styles.button, { backgroundColor: Colors.primary }]} onPress={sendNotification} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Dërgo te të gjithë</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backText: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  message: { minHeight: 150, textAlignVertical: 'top' },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
