import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCart } from '../context/CartContext';
import { useClientColors } from './ClientUI';

export function ShopHeader({ title }: { title?: string }) {
  const Colors = useClientColors();
  const { itemCount } = useCart();

  return (
    <View style={styles.wrap}>
      <View style={styles.logoRow}>
        <Image
          source={require('../assets/images/LOGO_HORIZONTAL.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Pressable
          onPress={() => router.push('/client/cart')}
          style={[styles.cartButton, { backgroundColor: Colors.card, borderColor: Colors.border }]}
        >
          <Ionicons name="cart-outline" size={21} color={Colors.primary} />
          {itemCount > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.danger }]}>
              <Text style={styles.badgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      {!!title && <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  logoRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 132,
    height: 38,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 14,
  },
});
