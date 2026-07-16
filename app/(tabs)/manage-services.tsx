import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';

import { DarkColors, LightColors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';
import { useTheme } from '../../context/ThemeContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { getOrderedCatalogIds } from '../../utils/catalog';

type Service = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  price: number;
  duration: number;
  image_url: string | null;
  is_active: boolean;
  is_on_sale: boolean | null;
  sale_price: number | null;
};

type FormState = {
  name: string;
  subtitle: string;
  description: string;
  price: string;
  duration: string;
  image_url: string;
  is_active: boolean;
  is_on_sale: boolean;
  sale_price: string;
};

const EMPTY_FORM: FormState = {
  name: '', subtitle: '', description: '', price: '', duration: '30', image_url: '',
  is_active: true, is_on_sale: false, sale_price: '',
};

function orderByIds(items: Service[], orderedIds: string[]) {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export default function ManageServicesScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadServices = useCallback(async () => {
    if (!user) return;
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'owner') {
      setAllowed(false);
      setLoading(false);
      router.replace('/(tabs)/profile');
      return;
    }
    setAllowed(true);
    const [{ data, error }, { data: orderData }] = await Promise.all([
      supabase.from('services').select('id, name, subtitle, description, price, duration, image_url, is_active, is_on_sale, sale_price').order('created_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('content').select('value').eq('key', 'service_order').maybeSingle(),
    ]);
    if (error) Alert.alert('Gabim', error.message);
    const ids = getOrderedCatalogIds(orderData?.value);
    setServices(orderByIds((data as Service[] | null) ?? [], ids));
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadServices(); }, [loadServices]);
  useAutoRefresh(loadServices, { enabled: allowed === true, tables: ['services', 'content'], channelName: 'manage-services' });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      subtitle: service.subtitle ?? '',
      description: service.description ?? '',
      price: String(service.price),
      duration: String(service.duration),
      image_url: service.image_url ?? '',
      is_active: service.is_active !== false,
      is_on_sale: service.is_on_sale === true,
      sale_price: service.sale_price == null ? '' : String(service.sale_price),
    });
    setModalVisible(true);
  };

  const save = async () => {
    const price = Number(form.price.replace(',', '.'));
    const duration = Number(form.duration);
    const salePrice = form.sale_price ? Number(form.sale_price.replace(',', '.')) : null;
    if (!form.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(duration) || duration <= 0) {
      Alert.alert('Kontrolloni të dhënat', 'Emri, çmimi dhe kohëzgjatja janë të detyrueshme.');
      return;
    }
    if (form.is_on_sale && (salePrice == null || !Number.isFinite(salePrice) || salePrice < 0)) {
      Alert.alert('Kontrolloni zbritjen', 'Vendosni një çmim valid të zbritur.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(), subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null, price, duration: Math.round(duration),
      image_url: form.image_url.trim() || null, is_active: form.is_active,
      is_on_sale: form.is_on_sale, sale_price: form.is_on_sale ? salePrice : null,
    };
    const result = editing
      ? await supabase.from('services').update(payload).eq('id', editing.id)
      : await supabase.from('services').insert(payload);
    setSaving(false);
    if (result.error) { Alert.alert('Ruajtja dështoi', result.error.message); return; }
    setModalVisible(false);
    await loadServices();
  };

  const pickPhoto = async () => {
    if (!user || uploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kërkohet leje', 'Lejoni qasjen te fotot për të zgjedhur fotografinë e shërbimit.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      setUploadingPhoto(true);
      const optimized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200, height: 900 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      const bytes = await fetch(optimized.uri).then((response) => response.arrayBuffer());
      const filePath = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('service-images')
        .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('service-images').getPublicUrl(filePath);
      setField('image_url', `${data.publicUrl}?t=${Date.now()}`);
    } catch (error: any) {
      Alert.alert('Fotoja nuk u ngarkua', error?.message ?? 'Ju lutemi provoni përsëri.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const remove = (service: Service) => {
    const execute = async () => {
      const { error } = await supabase.from('services').delete().eq('id', service.id);
      if (error) { Alert.alert('Fshirja dështoi', error.message); return; }
      setServices((current) => current.filter((item) => item.id !== service.id));
    };
    const message = `A dëshironi ta fshini shërbimin “${service.name}”?`;
    if (Platform.OS === 'web') { if (window.confirm(message)) void execute(); return; }
    Alert.alert('Fshi shërbimin', message, [
      { text: 'Anulo', style: 'cancel' },
      { text: 'Fshi', style: 'destructive', onPress: () => void execute() },
    ]);
  };

  const saveOrder = async (items: Service[]) => {
    const { error } = await supabase.from('content').upsert({
      key: 'service_order',
      value: { orderedIds: items.map((item) => item.id) },
    }, { onConflict: 'key' });
    if (error) Alert.alert('Renditja nuk u ruajt', error.message);
  };

  if (loading || allowed === null) return <View style={[styles.center, { backgroundColor: Colors.background }]}><ActivityIndicator color={Colors.primary} /></View>;
  if (!allowed) return null;

  return (
    <View style={[styles.screen, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: Colors.text }]}>Menaxho shërbimet</Text>
          <Text style={[styles.subtitle, { color: Colors.muted }]}>Trajtimet që shfaqen në aplikacion dhe rezervime.</Text>
        </View>
        <Pressable onPress={openCreate} style={[styles.addButton, { backgroundColor: Colors.primary }]}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addText}>Shto</Text>
        </Pressable>
      </View>
      <DraggableFlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        activationDistance={6}
        autoscrollThreshold={70}
        onDragEnd={({ data }) => {
          setServices(data);
          void saveOrder(data);
        }}
        onRefresh={() => void loadServices()}
        refreshing={loading}
        ListEmptyComponent={<Text style={[styles.empty, { color: Colors.muted }]}>Nuk ka shërbime.</Text>}
        renderItem={({ item, drag, isActive }: RenderItemParams<Service>) => (
          <View style={[styles.card, { backgroundColor: isActive ? Colors.primarySoft : Colors.card, borderColor: isActive ? Colors.primary : Colors.border }]}>
            <Pressable onLongPress={drag} delayLongPress={120} style={styles.dragHandle} hitSlop={10}>
              <Ionicons name="reorder-three" size={31} color={isActive ? Colors.primary : Colors.muted} />
            </Pressable>
            <View style={styles.cardCopy}>
              <Text style={[styles.serviceName, { color: Colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: Colors.muted }]}>
                {item.duration} min · {Number(item.price).toFixed(2)} EUR · {item.is_active === false ? 'Jo aktiv' : 'Aktiv'}
              </Text>
              {item.is_on_sale && item.sale_price != null && <Text style={[styles.sale, { color: Colors.primary }]}>Në zbritje: {Number(item.sale_price).toFixed(2)} EUR</Text>}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => openEdit(item)} style={[styles.iconButton, { backgroundColor: Colors.surface }]}><Ionicons name="pencil" size={18} color={Colors.text} /></Pressable>
              <Pressable onPress={() => remove(item)} style={[styles.iconButton, { backgroundColor: Colors.surface }]}><Ionicons name="trash-outline" size={19} color={Colors.danger} /></Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setModalVisible(false); }} />
          <View style={[styles.modal, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>{editing ? 'Ndrysho shërbimin' : 'Shto shërbim'}</Text>
              <Pressable onPress={() => setModalVisible(false)}><Ionicons name="close" size={25} color={Colors.text} /></Pressable>
            </View>
            <FlatList
              data={[{ key: 'form' }]}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              renderItem={() => (
                <View style={styles.form}>
                  <Field label="Emri *" value={form.name} onChangeText={(v: string) => setField('name', v)} colors={Colors} />
                  <Field label="Nëntitulli" value={form.subtitle} onChangeText={(v: string) => setField('subtitle', v)} colors={Colors} />
                  <Field label="Përshkrimi" value={form.description} onChangeText={(v: string) => setField('description', v)} colors={Colors} multiline />
                  <View style={styles.twoColumns}>
                    <View style={styles.column}><Field label="Çmimi EUR *" value={form.price} onChangeText={(v: string) => setField('price', v)} colors={Colors} keyboardType="decimal-pad" /></View>
                    <View style={styles.column}><Field label="Kohëzgjatja min *" value={form.duration} onChangeText={(v: string) => setField('duration', v)} colors={Colors} keyboardType="number-pad" /></View>
                  </View>
                  <View>
                    <Text style={[styles.label, { color: Colors.muted }]}>Fotografia</Text>
                    {!!form.image_url && <Image source={{ uri: form.image_url }} style={styles.photoPreview} resizeMode="cover" />}
                    <View style={styles.photoActions}>
                      <Pressable
                        disabled={uploadingPhoto}
                        onPress={() => void pickPhoto()}
                        style={[styles.photoButton, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                      >
                        {uploadingPhoto ? <ActivityIndicator color={Colors.primary} /> : <Ionicons name="images-outline" size={20} color={Colors.primary} />}
                        <Text style={[styles.photoButtonText, { color: Colors.text }]}>{form.image_url ? 'Ndrysho fotografinë' : 'Zgjidh nga galeria'}</Text>
                      </Pressable>
                      {!!form.image_url && <Pressable onPress={() => setField('image_url', '')} style={[styles.removePhoto, { backgroundColor: Colors.surface }]}><Ionicons name="trash-outline" size={19} color={Colors.danger} /></Pressable>}
                    </View>
                  </View>
                  <Toggle label="Shërbimi aktiv" value={form.is_active} onValueChange={(v: boolean) => setField('is_active', v)} colors={Colors} />
                  <Toggle label="Në zbritje" value={form.is_on_sale} onValueChange={(v: boolean) => setField('is_on_sale', v)} colors={Colors} />
                  {form.is_on_sale && <Field label="Çmimi me zbritje EUR *" value={form.sale_price} onChangeText={(v: string) => setField('sale_price', v)} colors={Colors} keyboardType="decimal-pad" />}
                  <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, { backgroundColor: Colors.primary, opacity: saving ? 0.65 : 1 }]}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Ruaj shërbimin</Text>}
                  </Pressable>
                </View>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field({ label, colors, multiline, ...props }: any) {
  return <View><Text style={[styles.label, { color: colors.muted }]}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.textArea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /></View>;
}

function Toggle({ label, value, onValueChange, colors }: any) {
  return <View style={styles.toggle}><Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerCopy: { flex: 1 }, title: { fontSize: 25, fontWeight: '900' }, subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  addButton: { minHeight: 44, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 5 }, addText: { color: '#fff', fontWeight: '900' },
  list: { paddingHorizontal: 18, paddingBottom: 120, gap: 10 }, empty: { textAlign: 'center', paddingVertical: 40 },
  card: { minHeight: 82, borderWidth: 1, borderRadius: 17, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dragHandle: { width: 34, minHeight: 52, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, justifyContent: 'center' },
  serviceName: { fontSize: 16, fontWeight: '900' }, meta: { fontSize: 12, marginTop: 5 }, sale: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  actions: { width: 91, flexDirection: 'row', justifyContent: 'flex-end', gap: 7 }, iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, modalTitle: { fontSize: 21, fontWeight: '900' },
  form: { gap: 13, paddingBottom: 8 }, label: { fontSize: 12, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 49, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 }, textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: 10 }, column: { flex: 1 }, toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggleLabel: { fontSize: 14, fontWeight: '800' },
  photoPreview: { width: '100%', height: 180, borderRadius: 15, marginBottom: 9 }, photoActions: { flexDirection: 'row', gap: 8 },
  photoButton: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, photoButtonText: { fontSize: 13, fontWeight: '800' },
  removePhoto: { width: 49, height: 49, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  saveButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
