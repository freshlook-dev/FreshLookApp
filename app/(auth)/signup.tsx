'use client';

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../context/supabase';
import { sendWelcomeEmail } from '../../utils/sendWelcomeEmail';

/* ✅ THEME */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

const COUNTRIES = [
  { name: 'Kosovë', flag: '🇽🇰', dialCode: '+383', cities: ['Prishtinë', 'Prizren', 'Pejë', 'Gjakovë', 'Gjilan', 'Ferizaj', 'Mitrovicë', 'Fushë Kosovë', 'Vushtrri', 'Podujevë', 'Suharekë', 'Rahovec', 'Malishevë', 'Skenderaj', 'Drenas', 'Klinë', 'Deçan', 'Istog', 'Lipjan', 'Shtime', 'Kamenicë', 'Viti'] },
  { name: 'Shqipëri', flag: '🇦🇱', dialCode: '+355', cities: ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan', 'Korçë', 'Fier', 'Berat', 'Lushnjë', 'Pogradec', 'Lezhë', 'Kukës', 'Sarandë', 'Gjirokastër', 'Kamëz'] },
  { name: 'Maqedoni e Veriut', flag: '🇲🇰', dialCode: '+389', cities: ['Shkup', 'Tetovë', 'Kumanovë', 'Gostivar', 'Kërçovë', 'Strugë', 'Ohër', 'Prilep', 'Manastir', 'Shtip', 'Veles', 'Dibër'] },
  { name: 'Mali i Zi', flag: '🇲🇪', dialCode: '+382', cities: ['Podgoricë', 'Ulqin', 'Tuz', 'Tivar', 'Rozhajë'] },
  { name: 'Serbi', flag: '🇷🇸', dialCode: '+381', cities: ['Beograd', 'Novi Sad', 'Nish', 'Preshevë', 'Bujanoc'] },
  { name: 'Bosnjë dhe Hercegovinë', flag: '🇧🇦', dialCode: '+387', cities: ['Sarajevë', 'Tuzla', 'Zenicë', 'Banja Luka', 'Mostar'] },
  { name: 'Kroaci', flag: '🇭🇷', dialCode: '+385', cities: ['Zagreb', 'Split', 'Rijekë', 'Osijek', 'Zadar'] },
  { name: 'Slloveni', flag: '🇸🇮', dialCode: '+386', cities: ['Ljubljanë', 'Maribor', 'Koper', 'Kranj', 'Celje'] },
  { name: 'Gjermani', flag: '🇩🇪', dialCode: '+49', cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Stuttgart', 'Frankfurt', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg'] },
  { name: 'Zvicër', flag: '🇨🇭', dialCode: '+41', cities: ['Zürich', 'Bern', 'Basel', 'Genève', 'Lausanne', 'Winterthur', 'Luzern', 'St. Gallen', 'Lugano', 'Biel'] },
  { name: 'Austri', flag: '🇦🇹', dialCode: '+43', cities: ['Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn'] },
  { name: 'Itali', flag: '🇮🇹', dialCode: '+39', cities: ['Milano', 'Roma', 'Torino', 'Bologna', 'Verona', 'Napoli', 'Firenze', 'Genova', 'Palermo', 'Bari', 'Venezia', 'Padova'] },
  { name: 'Francë', flag: '🇫🇷', dialCode: '+33', cities: ['Paris', 'Lyon', 'Marseille', 'Strasbourg', 'Nice'] },
  { name: 'Belgjikë', flag: '🇧🇪', dialCode: '+32', cities: ['Bruxelles', 'Antwerp', 'Gent', 'Liège', 'Charleroi'] },
  { name: 'Holandë', flag: '🇳🇱', dialCode: '+31', cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'] },
  { name: 'Suedi', flag: '🇸🇪', dialCode: '+46', cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås'] },
  { name: 'Norvegji', flag: '🇳🇴', dialCode: '+47', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen'] },
  { name: 'Danimarkë', flag: '🇩🇰', dialCode: '+45', cities: ['København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'] },
  { name: 'Turqi', flag: '🇹🇷', dialCode: '+90', cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'] },
  { name: 'Mbretëria e Bashkuar', flag: '🇬🇧', dialCode: '+44', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Glasgow', 'Edinburgh', 'Bristol', 'Sheffield', 'Leicester', 'Cardiff', 'Nottingham'] },
  { name: 'Shtetet e Bashkuara', flag: '🇺🇸', dialCode: '+1', cities: ['New York', 'Chicago', 'Los Angeles', 'Boston', 'Miami', 'Houston', 'Dallas', 'Philadelphia', 'Washington', 'Seattle', 'San Francisco', 'Atlanta', 'Detroit', 'Denver'] },
  { name: 'Kanada', flag: '🇨🇦', dialCode: '+1', cities: ['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Ottawa'] },
  { name: 'Australi', flag: '🇦🇺', dialCode: '+61', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'] },
];

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryIndex, setCountryIndex] = useState(0);
  const [phonePrefixIndex, setPhonePrefixIndex] = useState(0);
  const [city, setCity] = useState(COUNTRIES[0].cities[0]);
  const [openSelector, setOpenSelector] = useState<'country' | 'city' | 'prefix' | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const handleSignUp = async () => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanCode = accessCode.trim();
    const country = COUNTRIES[countryIndex];
    const phonePrefix = COUNTRIES[phonePrefixIndex];

    if (!cleanEmail || !password || !confirmPassword || !cleanName || !cleanPhone || !country || !city) {
      Alert.alert('Gabim', 'Plotësoni të gjitha fushat e detyrueshme.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Fjalëkalimet nuk përputhen', 'Shkruani të njëjtin fjalëkalim në të dy fushat.');
      return;
    }

    setLoading(true);

    try {
      let codeData: { id: string } | null = null;

      if (cleanCode) {
        const { data, error: codeError } = await supabase
          .from('access_codes')
          .select('id')
          .eq('code', cleanCode)
          .eq('role', 'staff')
          .eq('used', false)
          .maybeSingle();

        if (codeError || !data) {
          Alert.alert('Invalid code', 'Access code is invalid or already used');
          return;
        }

        codeData = data;
      }

      const nextRole = codeData ? 'staff' : 'client';

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              phone: `${phonePrefix.dialCode}${cleanPhone.replace(/\D/g, '')}`,
              country: country.name,
              city,
              phone_country_code: phonePrefix.dialCode,
              role: nextRole,
            },
          },
        });

      if (signUpError || !signUpData.user) {
        setLoading(false);
        Alert.alert('Signup failed', signUpError?.message || 'Unknown error');
        return;
      }

      if (!signUpData.session) {
        Alert.alert(
          'Confirm your email',
          'We sent a confirmation link to your email address. Confirm your account, then return here to sign in.'
        );
        router.replace('/(auth)/login');
        return;
      }

      if (codeData) {
        const { error: codeUpdateError } = await supabase
          .from('access_codes')
          .update({ used: true })
          .eq('id', codeData.id)
          .eq('used', false);

        if (codeUpdateError) {
          Alert.alert('Access code error', codeUpdateError.message);
          return;
        }

        await supabase.from('audit_logs').insert({
          actor_id: signUpData.user.id,
          action: 'USE_ACCESS_CODE',
          target_id: codeData.id,
        });
      }

      void sendWelcomeEmail(signUpData.session.access_token);
      Alert.alert('Success', `Account created successfully as ${nextRole}`);
      router.replace(nextRole === 'client' ? '/client' : '/(tabs)');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: Colors.text }]}>
              Krijoni llogari
            </Text>
            <Text style={[styles.subtitle, { color: Colors.muted }]}>
              Krijoni llogari klienti ose vendosni kodin e qasjes për staf
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: Colors.card }]}>
            <TextInput
              placeholder="Emri i plotë"
              placeholderTextColor={Colors.muted}
              value={fullName}
              onChangeText={setFullName}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
            />

            <SelectLine
              label="Shteti"
              value={`${COUNTRIES[countryIndex].flag} ${COUNTRIES[countryIndex].name}`}
              Colors={Colors}
              onPress={() => setOpenSelector('country')}
            />

            <SelectLine
              label="Qyteti"
              value={city}
              Colors={Colors}
              onPress={() => setOpenSelector('city')}
            />

            <View style={styles.phoneRow}>
              <Pressable
                onPress={() => setOpenSelector('prefix')}
                style={[styles.prefixPicker, { backgroundColor: Colors.background, borderColor: Colors.primary }]}
              >
                <Text style={[styles.prefixText, { color: Colors.text }]}>{COUNTRIES[phonePrefixIndex].flag} {COUNTRIES[phonePrefixIndex].dialCode}</Text>
                <Ionicons name="chevron-down" size={17} color={Colors.primary} />
              </Pressable>
              <TextInput
                placeholder="Numri i telefonit"
                placeholderTextColor={Colors.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, ''))}
                returnKeyType="next"
                style={[styles.phoneInput, { backgroundColor: Colors.background, color: Colors.text, borderColor: Colors.primary }]}
              />
            </View>

            <TextInput
              placeholder="Adresa e emailit"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
            />

            <TextInput
              placeholder="Fjalëkalimi"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
            />

            <TextInput
              placeholder="Konfirmoni fjalëkalimin"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="next"
              style={[styles.input, { backgroundColor: Colors.background, color: Colors.text, borderColor: Colors.primary }]}
            />

            <TextInput
              placeholder="Kodi 5-shifror i stafit (opsional)"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              maxLength={5}
              value={accessCode}
              onChangeText={setAccessCode}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
            />

            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              style={[styles.button, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Regjistrohu</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Kthehu te hyrja</Text>
            </Pressable>
          </View>

          <SelectModal
            visible={openSelector === 'country'}
            title="Zgjidhni shtetin"
            options={COUNTRIES.map((item, index) => ({ label: `${item.flag} ${item.name}`, value: index }))}
            Colors={Colors}
            onClose={() => setOpenSelector(null)}
            onSelect={(index) => {
              setCountryIndex(index as number);
              setCity(COUNTRIES[index as number].cities[0]);
              setOpenSelector(null);
            }}
          />
          <SelectModal
            visible={openSelector === 'city'}
            title="Zgjidhni qytetin"
            options={COUNTRIES[countryIndex].cities.map((item) => ({ label: item, value: item }))}
            Colors={Colors}
            onClose={() => setOpenSelector(null)}
            onSelect={(value) => {
              setCity(value as string);
              setOpenSelector(null);
            }}
          />
          <SelectModal
            visible={openSelector === 'prefix'}
            title="Zgjidhni prefiksin"
            options={COUNTRIES.map((item, index) => ({ label: `${item.flag} ${item.name} (${item.dialCode})`, value: index }))}
            Colors={Colors}
            onClose={() => setOpenSelector(null)}
            onSelect={(index) => {
              setPhonePrefixIndex(index as number);
              setOpenSelector(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    width: '100%',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  selectLine: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  selectLabel: { fontSize: 14, fontWeight: '700' },
  selectValue: { flex: 1, textAlign: 'right', marginLeft: 12, fontSize: 14 },
  phoneRow: { flexDirection: 'row', gap: 10, minHeight: 54, marginBottom: 14 },
  prefixPicker: { width: 138, minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  prefixText: { fontSize: 15, fontWeight: '700' },
  phoneInput: { flex: 1, minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: '#C9A24D',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  modalSheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  modalHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 19, fontWeight: '800', marginBottom: 8 },
  optionList: { maxHeight: 420 },
  optionRow: { minHeight: 54, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontSize: 16, fontWeight: '600' },
});

function SelectLine({ label, value, Colors, onPress }: { label: string; value: string; Colors: typeof LightColors; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.selectLine, { backgroundColor: Colors.background, borderColor: Colors.primary }]}>
      <Text style={[styles.selectLabel, { color: Colors.text }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.selectValue, { color: Colors.muted }]}>{value}</Text>
      <Text style={{ color: Colors.primary, marginLeft: 8 }}>⌄</Text>
    </Pressable>
  );
}

function SelectModal({ visible, title, options, Colors, onClose, onSelect }: { visible: boolean; title: string; options: { label: string; value: string | number }[]; Colors: typeof LightColors; onClose: () => void; onSelect: (value: string | number) => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: Colors.card }]} onPress={(event) => event.stopPropagation()}>
          <View style={[styles.modalHandle, { backgroundColor: Colors.border }]} />
          <Text style={[styles.modalTitle, { color: Colors.text }]}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.optionList}>
            {options.map((option) => (
              <Pressable key={`${option.value}-${option.label}`} onPress={() => onSelect(option.value)} style={[styles.optionRow, { borderBottomColor: Colors.border }]}>
                <Text style={[styles.optionText, { color: Colors.text }]}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
