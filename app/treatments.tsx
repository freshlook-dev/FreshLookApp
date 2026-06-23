import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../context/supabase';
import { useTheme } from '../context/ThemeContext';
import { DarkColors, LightColors } from '../constants/colors';

type CatalogItem = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  price: number;
  duration?: number | null;
  image_url: string | null;
  is_on_sale?: boolean | null;
  sale_price?: number | null;
  is_out_of_stock?: boolean | null;
};

type Tab = 'treatments' | 'products' | 'app';

const APP_PREVIEWS = [
  require('../screenshots/client-app/01-home.png'),
  require('../screenshots/client-app/04-rewards.png'),
  require('../screenshots/client-app/08-book-service.png'),
];

export default function TreatmentsScreen() {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [activeTab, setActiveTab] = useState<Tab>('treatments');
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatalog = async () => {
    const [servicesResult, productsResult] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, subtitle, description, price, duration, image_url, is_on_sale, sale_price')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('products')
        .select('id, name, subtitle, description, price, image_url, is_on_sale, sale_price, is_out_of_stock')
        .eq('is_active', true)
        .order('name'),
    ]);

    setServices((servicesResult.data as CatalogItem[] | null) ?? []);
    setProducts((productsResult.data as CatalogItem[] | null) ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const startBooking = () => router.push('/(auth)/login');

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadCatalog();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.brand, { color: Colors.primary }]}>MY FRESHLOOK</Text>
          <Text style={[styles.headline, { color: Colors.text }]}>Bukuria, më thjesht.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hyr"
          onPress={startBooking}
          style={[styles.signInButton, { backgroundColor: Colors.primary }]}
        >
          <Text style={[styles.signInText, { color: Colors.onPrimary }]}>Hyr</Text>
        </Pressable>
      </View>

      <View style={[styles.tabBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <TabButton label="Trajtimet" selected={activeTab === 'treatments'} onPress={() => setActiveTab('treatments')} />
        <TabButton label="Produktet" selected={activeTab === 'products'} onPress={() => setActiveTab('products')} />
        <TabButton label="Aplikacioni" selected={activeTab === 'app'} onPress={() => setActiveTab('app')} />
      </View>

      {activeTab === 'treatments' && (
        <CatalogPage
          heading="Trajtimet për ju"
          subtitle="Shfletoni trajtimet tona aktuale në sallon. Nuk nevojitet llogari."
          items={services}
          loading={loading}
          Colors={Colors}
          kind="treatment"
          onAction={startBooking}
        />
      )}

      {activeTab === 'products' && (
        <CatalogPage
          heading="Produktet e kujdesit për lëkurën"
          subtitle="Zbuloni produktet që gjenden aktualisht te Fresh Look."
          items={products}
          loading={loading}
          Colors={Colors}
          kind="product"
          onAction={startBooking}
        />
      )}

      {activeTab === 'app' && <AppPresentation Colors={Colors} onAction={startBooking} />}
    </ScrollView>
  );
}

function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && { backgroundColor: Colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 }]}
    >
      <Text style={[styles.tabText, { color: selected ? Colors.primary : Colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function CatalogPage({
  heading,
  subtitle,
  items,
  loading,
  Colors,
  kind,
  onAction,
}: {
  heading: string;
  subtitle: string;
  items: CatalogItem[];
  loading: boolean;
  Colors: typeof LightColors;
  kind: 'treatment' | 'product';
  onAction: () => void;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: Colors.text }]}>{heading}</Text>
      <Text style={[styles.sectionSubtitle, { color: Colors.muted }]}>{subtitle}</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : items.length ? (
        <View style={styles.catalogList}>
          {items.map((item) => <CatalogCard key={item.id} item={item} kind={kind} Colors={Colors} onAction={onAction} />)}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: Colors.muted }}>Aktualisht nuk ka produkte ose trajtime të disponueshme. Ju lutemi provoni përsëri së shpejti.</Text>
        </View>
      )}
    </View>
  );
}

function CatalogCard({ item, kind, Colors, onAction }: { item: CatalogItem; kind: 'treatment' | 'product'; Colors: typeof LightColors; onAction: () => void }) {
  const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
  const unavailable = kind === 'product' && item.is_out_of_stock;

  return (
    <View style={[styles.catalogCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.catalogImage} resizeMode="cover" />
      ) : (
        <View style={[styles.catalogImage, styles.imageFallback, { backgroundColor: Colors.primarySoft }]}>
          <Ionicons name={kind === 'treatment' ? 'sparkles-outline' : 'leaf-outline'} size={30} color={Colors.primary} />
        </View>
      )}
      <View style={styles.catalogCopy}>
        <View style={styles.cardTopLine}>
          <Text style={[styles.itemName, { color: Colors.text }]}>{item.name}</Text>
          {item.is_on_sale && <Text style={[styles.salePill, { color: Colors.primary, backgroundColor: Colors.primarySoft }]}>Ulje</Text>}
        </View>
        {!!item.subtitle && <Text style={[styles.itemSubtitle, { color: Colors.muted }]}>{item.subtitle}</Text>}
        {!!item.description && <Text numberOfLines={2} style={[styles.description, { color: Colors.muted }]}>{item.description}</Text>}
        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.price, { color: Colors.primary }]}>{price} EUR</Text>
            {kind === 'treatment' && <Text style={[styles.duration, { color: Colors.muted }]}>{item.duration} min.</Text>}
            {unavailable && <Text style={[styles.outOfStock, { color: Colors.danger }]}>Nuk ka në stok</Text>}
          </View>
          {!unavailable && (
            <Pressable onPress={onAction} style={[styles.actionButton, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.actionText, { color: Colors.onPrimary }]}>{kind === 'treatment' ? 'Rezervo' : 'Porosit'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function AppPresentation({ Colors, onAction }: { Colors: typeof LightColors; onAction: () => void }) {
  const benefits = [
    ['calendar-outline', 'Rezervoni shpejt', 'Zgjidhni trajtimin, lokacionin, datën dhe orën në një proces të thjeshtë.'],
    ['gift-outline', 'Mbani shpërblimet tuaja', 'Ndiqni Fresh Points dhe krijoni një kupon shpërblimi kur të jeni gati.'],
    ['person-outline', 'Gjithçka në një vend', 'Menaxhoni vizitat dhe profilin tuaj sa herë që ju përshtatet.'],
  ] as const;

  return (
    <View>
      <View style={[styles.introHero, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.heroEyebrow, { color: Colors.onPrimary }]}>APLIKACIONI MY FRESHLOOK</Text>
        <Text style={[styles.heroTitle, { color: Colors.onPrimary }]}>Rutina juaj e bukurisë,{`\n`}gjithmonë me ju.</Text>
        <Text style={[styles.heroText, { color: Colors.onPrimary }]}>Krijoni një llogari falas për të rezervuar vizita, ndjekur shpërblimet dhe menaxhuar çdo termin me lehtësi.</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: Colors.text }]}>Pse të krijoni llogari?</Text>
      <View style={styles.benefitList}>
        {benefits.map(([icon, title, copy]) => (
          <View key={title} style={[styles.benefitCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
            <View style={[styles.benefitIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name={icon} size={22} color={Colors.primary} />
            </View>
            <View style={styles.benefitCopy}>
              <Text style={[styles.benefitTitle, { color: Colors.text }]}>{title}</Text>
              <Text style={[styles.benefitText, { color: Colors.muted }]}>{copy}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: Colors.text }]}>Shikoni më nga afër</Text>
      <Text style={[styles.sectionSubtitle, { color: Colors.muted }]}>Gjithçka që ju nevojitet, për vizitën tuaj të ardhshme.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
        {APP_PREVIEWS.map((preview, index) => <Image key={index} source={preview} style={[styles.appPreview, { borderColor: Colors.border }]} resizeMode="cover" />)}
      </ScrollView>

      <Pressable onPress={onAction} style={[styles.joinButton, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.joinButtonText, { color: Colors.onPrimary }]}>Krijoni llogari për të rezervuar</Text>
        <Ionicons name="arrow-forward" size={19} color={Colors.onPrimary} />
      </Pressable>
      <Pressable onPress={() => router.push('/(auth)/login')}>
        <Text style={[styles.existingAccountText, { color: Colors.primary }]}>Kam tashmë një llogari</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  brand: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  headline: { marginTop: 6, fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  signInButton: { borderRadius: 13, paddingHorizontal: 15, paddingVertical: 11 },
  signInText: { fontSize: 14, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderWidth: 1, padding: 4, borderRadius: 15, marginTop: 26, marginBottom: 28 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 11 },
  tabText: { fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  sectionSubtitle: { marginTop: 7, fontSize: 14, lineHeight: 20 },
  center: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  catalogList: { gap: 16, marginTop: 22 },
  catalogCard: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  catalogImage: { width: '100%', height: 180 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  catalogCopy: { padding: 16 },
  cardTopLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' },
  itemName: { flex: 1, fontSize: 18, fontWeight: '800' },
  salePill: { overflow: 'hidden', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  itemSubtitle: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  description: { marginTop: 7, fontSize: 13, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  price: { fontSize: 17, fontWeight: '900' },
  duration: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  outOfStock: { marginTop: 4, fontSize: 12, fontWeight: '800' },
  actionButton: { minWidth: 82, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionText: { fontSize: 13, fontWeight: '800' },
  introHero: { borderRadius: 24, padding: 24, marginBottom: 30 },
  heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.8 },
  heroTitle: { marginTop: 12, fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.7 },
  heroText: { marginTop: 12, fontSize: 14, lineHeight: 21, opacity: 0.9 },
  benefitList: { gap: 11, marginTop: 18, marginBottom: 30 },
  benefitCard: { borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', gap: 13 },
  benefitIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '800' },
  benefitText: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  previewRow: { gap: 14, paddingVertical: 18, paddingRight: 20 },
  appPreview: { width: 170, height: 300, borderRadius: 20, borderWidth: 1 },
  joinButton: { minHeight: 56, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  joinButtonText: { fontSize: 15, fontWeight: '800' },
  existingAccountText: { marginTop: 18, textAlign: 'center', fontSize: 14, fontWeight: '800' },
});
