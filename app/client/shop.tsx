import { useCallback, useEffect, useState } from 'react';
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

import { EmptyState, useClientColors } from '../../components/ClientUI';
import { ShopHeader } from '../../components/ShopHeader';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../context/supabase';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { getCatalogImageUrl } from '../../utils/imageUrl';
import { getOrderedCatalogIds } from '../../utils/catalog';

type Product = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  price: number;
  sale_price: number | null;
  is_on_sale: boolean;
  image_url: string | null;
  is_active: boolean;
  is_out_of_stock: boolean;
  stock_quantity: number | null;
  stock_online: number | null;
};

const orderByIdList = (items: Product[], orderedIds: string[]) => {
  if (!orderedIds.length) return items;
  const positionMap = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aPosition = positionMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = positionMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) return aPosition - bPosition;
    return 0;
  });
};

export default function ClientShopScreen() {
  const Colors = useClientColors();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(async () => {
    const [{ data: productRows }, { data: orderData }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, subtitle, description, price, sale_price, is_on_sale, image_url, is_active, is_out_of_stock, stock_quantity, stock_online')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('content').select('value').eq('key', 'product_order').maybeSingle(),
    ]);

    const orderedIds = getOrderedCatalogIds(orderData?.value);
    setProducts(orderByIdList((productRows as Product[] | null) ?? [], orderedIds));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useAutoRefresh(loadProducts, {
    tables: ['products', 'content'],
    channelName: 'client-products',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const handleAdd = (product: Product) => {
    const availableOnlineStock = product.stock_online ?? product.stock_quantity ?? 0;
    const isSoldOut = product.is_out_of_stock || availableOnlineStock <= 0;
    if (isSoldOut) return;

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url || '',
      is_on_sale: product.is_on_sale,
      sale_price: product.sale_price,
      is_out_of_stock: product.is_out_of_stock,
      stock_quantity: availableOnlineStock,
      stock_online: product.stock_online,
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <ShopHeader title="Produktet" />
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Produkte profesionale për kujdesin tuaj të përditshëm.
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : products.length === 0 ? (
        <EmptyState
          icon="bag-outline"
          title="Nuk ka produkte aktive"
          message="Produktet do të shfaqen këtu sapo të jenë të disponueshme."
        />
      ) : (
        <View style={styles.grid}>
          {products.map((product) => {
            const availableOnlineStock = product.stock_online ?? product.stock_quantity ?? 0;
            const isSoldOut = product.is_out_of_stock || availableOnlineStock <= 0;
            const isSale = product.is_on_sale && product.sale_price != null;
            const expandedProduct = expanded === product.id;

            return (
              <View
                key={product.id}
                style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}
              >
                <View style={[styles.imageWrap, { backgroundColor: Colors.surface }]}>
                  {product.image_url ? (
                    <ProductImage
                      url={product.image_url}
                      soldOut={isSoldOut}
                      fallbackColor={Colors.muted}
                    />
                  ) : (
                    <Ionicons name="image-outline" size={34} color={Colors.muted} />
                  )}
                  {isSale && !isSoldOut && (
                    <View style={styles.saleBadge}>
                      <Text style={styles.saleText}>Zbritje</Text>
                    </View>
                  )}
                  {isSoldOut && (
                    <View style={styles.stockBadge}>
                      <Text style={styles.stockText}>Pa stok</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.productName, { color: Colors.text }]} numberOfLines={2}>
                  {product.name}
                </Text>
                {!!product.subtitle && (
                  <Text style={[styles.productSubtitle, { color: Colors.muted }]} numberOfLines={2}>
                    {product.subtitle}
                  </Text>
                )}

                <View style={styles.priceRow}>
                  {isSale ? (
                    <>
                      <Text style={[styles.oldPrice, { color: Colors.muted }]}>{product.price.toFixed(2)}€</Text>
                      <Text style={[styles.price, { color: Colors.primary }]}>{product.sale_price!.toFixed(2)}€</Text>
                    </>
                  ) : (
                    <Text style={[styles.price, { color: Colors.text }]}>{product.price.toFixed(2)}€</Text>
                  )}
                </View>

                {!!product.description && (
                  <Pressable onPress={() => setExpanded(expandedProduct ? null : product.id)}>
                    <Text style={[styles.detailsLink, { color: Colors.primary }]}>
                      {expandedProduct ? 'Fshih detajet' : 'Shiko detajet'}
                    </Text>
                  </Pressable>
                )}

                {expandedProduct && !!product.description && (
                  <Text style={[styles.description, { color: Colors.muted }]}>
                    {product.description}
                  </Text>
                )}

                <Pressable
                  onPress={() => handleAdd(product)}
                  disabled={isSoldOut}
                  style={[
                    styles.addButton,
                    { backgroundColor: isSoldOut ? Colors.border : Colors.primary },
                  ]}
                >
                  <Text style={styles.addButtonText}>{isSoldOut ? 'Pa stok' : 'Shto në shportë'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function ProductImage({
  url,
  soldOut,
  fallbackColor,
}: {
  url: string;
  soldOut: boolean;
  fallbackColor: string;
}) {
  const optimizedUrl = getCatalogImageUrl(url, 480);
  const [sourceUrl, setSourceUrl] = useState(optimizedUrl);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Ionicons name="image-outline" size={34} color={fallbackColor} />;
  }

  return (
    <Image
      source={{ uri: sourceUrl!, cache: 'force-cache' }}
      style={[styles.image, soldOut && styles.faded]}
      resizeMode="contain"
      onError={() => {
        if (sourceUrl !== url) setSourceUrl(url);
        else setFailed(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 140 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  loader: { marginTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', borderWidth: 1, borderRadius: 18, padding: 10 },
  imageWrap: { height: 132, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 },
  image: { width: '100%', height: '100%' },
  faded: { opacity: 0.55 },
  saleBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: '#D64545', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  saleText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  stockBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  stockText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  productName: { fontSize: 14, fontWeight: '800', minHeight: 36 },
  productSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  price: { fontSize: 15, fontWeight: '900' },
  detailsLink: { marginTop: 8, fontSize: 12, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  addButton: { minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
});
