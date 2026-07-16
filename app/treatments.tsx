import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { supabase } from '../context/supabase';
import { useTheme } from '../context/ThemeContext';
import { DarkColors, LightColors } from '../constants/colors';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { getCatalogImageUrl } from '../utils/imageUrl';
import { getOrderedCatalogIds } from '../utils/catalog';

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
  stock_quantity?: number | null;
  stock_online?: number | null;
};

type Tab = 'treatments' | 'products' | 'app';

const APP_PREVIEWS = [
  require('../screenshots/client-app/01-home.png'),
  require('../screenshots/client-app/04-rewards.png'),
  require('../screenshots/client-app/08-book-service.png'),
];

const orderByIdList = (items: CatalogItem[], orderedIds: string[]) => {
  if (!orderedIds.length) return items;
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aPosition = positions.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = positions.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
};

const isProductUnavailable = (item: CatalogItem) => {
  const availableOnlineStock = item.stock_online ?? item.stock_quantity ?? 0;
  return item.is_out_of_stock === true || availableOnlineStock <= 0;
};

export default function TreatmentsScreen() {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [activeTab, setActiveTab] = useState<Tab>('treatments');
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatalog = useCallback(async () => {
    const [servicesResult, productsResult, serviceOrderResult, productOrderResult] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, subtitle, description, price, duration, image_url, is_on_sale, sale_price')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('products')
        .select('id, name, subtitle, description, price, image_url, is_on_sale, sale_price, is_out_of_stock, stock_quantity, stock_online')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('content').select('value').eq('key', 'service_order').maybeSingle(),
      supabase.from('content').select('value').eq('key', 'product_order').maybeSingle(),
    ]);

    const serviceOrder = getOrderedCatalogIds(serviceOrderResult.data?.value);
    const productOrder = getOrderedCatalogIds(productOrderResult.data?.value);
    setServices(orderByIdList((servicesResult.data as CatalogItem[] | null) ?? [], serviceOrder));
    setProducts(orderByIdList((productsResult.data as CatalogItem[] | null) ?? [], productOrder));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useAutoRefresh(loadCatalog, {
    tables: ['services', 'products', 'content'],
    channelName: 'public-catalog',
  });

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
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  useEffect(() => {
    if (!selectedItem) return;
    setSelectedItem(items.find((item) => item.id === selectedItem.id) ?? null);
  }, [items, selectedItem?.id]);

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: Colors.text }]}>{heading}</Text>
      <Text style={[styles.sectionSubtitle, { color: Colors.muted }]}>{subtitle}</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : items.length ? (
        <View style={styles.catalogList}>
          {items.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              kind={kind}
              Colors={Colors}
              onAction={onAction}
              onOpen={() => setSelectedItem(item)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: Colors.muted }}>Aktualisht nuk ka produkte ose trajtime të disponueshme. Ju lutemi provoni përsëri së shpejti.</Text>
        </View>
      )}

      <CatalogDetailsModal
        item={selectedItem}
        kind={kind}
        Colors={Colors}
        onClose={() => setSelectedItem(null)}
        onAction={onAction}
      />
    </View>
  );
}

function CatalogCard({ item, kind, Colors, onAction, onOpen }: { item: CatalogItem; kind: 'treatment' | 'product'; Colors: typeof LightColors; onAction: () => void; onOpen: () => void }) {
  const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
  const unavailable = kind === 'product' && isProductUnavailable(item);
  const [imageFailed, setImageFailed] = useState(false);
  const optimizedImageUrl = getCatalogImageUrl(item.image_url);
  const [imageUrl, setImageUrl] = useState(optimizedImageUrl);
  const hasImage = !!item.image_url && !imageFailed;

  const handleImageError = () => {
    if (imageUrl !== item.image_url) {
      setImageUrl(item.image_url);
      return;
    }
    setImageFailed(true);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Shiko detajet për ${item.name}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.catalogCard,
        { backgroundColor: Colors.card, borderColor: Colors.border },
        pressed && styles.cardPressed,
      ]}
    >
      <View
        style={[
          styles.catalogImageStage,
          kind === 'product' && styles.productImageStage,
          { backgroundColor: kind === 'product' ? Colors.surface : Colors.primarySoft },
        ]}
      >
        {hasImage ? (
          <ExpoImage
            source={imageUrl!}
            style={[styles.catalogImage, kind === 'product' && styles.productImage]}
            contentFit={kind === 'product' ? 'contain' : 'cover'}
            cachePolicy="memory-disk"
            recyclingKey={imageUrl!}
            transition={180}
            onError={handleImageError}
          />
        ) : (
          <View style={styles.imageFallback}>
            <View style={[styles.fallbackIcon, { backgroundColor: Colors.card }]}>
              <Ionicons name={kind === 'treatment' ? 'sparkles-outline' : 'leaf-outline'} size={28} color={Colors.primary} />
            </View>
            <Text style={[styles.fallbackLabel, { color: Colors.muted }]}>MY FRESHLOOK</Text>
          </View>
        )}
        {kind === 'product' && (
          <View style={[styles.productCategoryPill, { backgroundColor: Colors.card }]}>
            <Ionicons name="sparkles" size={11} color={Colors.primary} />
            <Text style={[styles.productCategoryText, { color: Colors.primary }]}>KUJDES PROFESIONAL</Text>
          </View>
        )}
      </View>
      <View style={styles.catalogCopy}>
        <View style={styles.cardTopLine}>
          <Text style={[styles.itemName, { color: Colors.text }]}>{item.name}</Text>
          {item.is_on_sale && item.sale_price != null && <Text style={[styles.salePill, { color: Colors.primary, backgroundColor: Colors.primarySoft }]}>Ulje</Text>}
        </View>
        {!!item.subtitle && <Text style={[styles.itemSubtitle, { color: Colors.muted }]}>{item.subtitle}</Text>}
        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.price, { color: Colors.primary }]}>{price} EUR</Text>
            {kind === 'treatment' && <Text style={[styles.duration, { color: Colors.muted }]}>{item.duration} min.</Text>}
            {unavailable && <Text style={[styles.outOfStock, { color: Colors.danger }]}>Nuk ka në stok</Text>}
          </View>
          {!unavailable && (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onAction();
              }}
              style={[styles.actionButton, { backgroundColor: Colors.primary }]}
            >
              <Text style={[styles.actionText, { color: Colors.onPrimary }]}>{kind === 'treatment' ? 'Rezervo' : 'Porosit'}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.detailsHint}>
          <Text style={[styles.detailsHintText, { color: Colors.primary }]}>Shiko detajet</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function CatalogDetailsModal({ item, kind, Colors, onClose, onAction }: { item: CatalogItem | null; kind: 'treatment' | 'product'; Colors: typeof LightColors; onClose: () => void; onAction: () => void }) {
  if (!item) return null;

  const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
  const unavailable = kind === 'product' && isProductUnavailable(item);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.modalSheet, { backgroundColor: Colors.card, borderColor: Colors.border }]}
        >
          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name={kind === 'treatment' ? 'sparkles-outline' : 'leaf-outline'} size={22} color={Colors.primary} />
            </View>
            <Pressable accessibilityLabel="Mbyll" onPress={onClose} style={[styles.closeIconButton, { backgroundColor: Colors.surface }]}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.modalTitle, { color: Colors.text }]}>{item.name}</Text>
          {!!item.subtitle && <Text style={[styles.modalSubtitle, { color: Colors.muted }]}>{item.subtitle}</Text>}
          <Text style={[styles.modalDescription, { color: Colors.muted }]}>
            {item.description || 'Nuk ka përshkrim shtesë për këtë artikull.'}
          </Text>
          <View style={[styles.modalMeta, { borderColor: Colors.border }]}>
            <Text style={[styles.modalPrice, { color: Colors.primary }]}>{price} EUR</Text>
            {kind === 'treatment' && !!item.duration && <Text style={[styles.duration, { color: Colors.muted }]}>{item.duration} min.</Text>}
          </View>
          {!unavailable && (
            <Pressable onPress={onAction} style={[styles.modalAction, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.actionText, { color: Colors.onPrimary }]}>{kind === 'treatment' ? 'Rezervo' : 'Porosit'}</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={[styles.modalCloseButton, { borderColor: Colors.border }]}>
            <Text style={[styles.modalCloseText, { color: Colors.text }]}>Mbyll</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  catalogCard: { borderWidth: 1, borderRadius: 24, overflow: 'hidden', shadowColor: '#211E19', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 2 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  catalogImageStage: { width: '100%', height: 215, overflow: 'hidden' },
  productImageStage: { height: 255, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  catalogImage: { width: '100%', height: '100%' },
  productImage: { borderRadius: 16 },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#211E19', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  fallbackLabel: { marginTop: 12, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  productCategoryPill: { position: 'absolute', left: 14, top: 14, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, shadowColor: '#211E19', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
  productCategoryText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  catalogCopy: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12 },
  cardTopLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' },
  itemName: { flex: 1, fontSize: 18, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25 },
  salePill: { overflow: 'hidden', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  itemSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  price: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25 },
  duration: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  outOfStock: { marginTop: 4, fontSize: 12, fontWeight: '800' },
  actionButton: { minWidth: 88, minHeight: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionText: { fontSize: 13, fontWeight: '800' },
  detailsHint: { marginTop: 9, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(117,111,102,0.22)', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  detailsHintText: { fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,10,0.58)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalSheet: { width: '100%', maxWidth: 480, borderWidth: 1, borderRadius: 26, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  closeIconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.5 },
  modalSubtitle: { marginTop: 6, fontSize: 14, fontWeight: '700' },
  modalDescription: { marginTop: 16, fontSize: 15, lineHeight: 23 },
  modalMeta: { marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  modalPrice: { fontSize: 21, fontWeight: '900' },
  modalAction: { minHeight: 50, marginTop: 20, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalCloseButton: { minHeight: 50, marginTop: 10, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 14, fontWeight: '800' },
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
