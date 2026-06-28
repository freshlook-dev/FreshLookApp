import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from './supabase';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  is_on_sale?: boolean;
  sale_price?: number | null;
  is_out_of_stock?: boolean;
  stock_quantity?: number | null;
  stock_online?: number | null;
};

export type Promo = {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
};

type ProductSnapshot = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_on_sale: boolean;
  sale_price: number | null;
  is_out_of_stock: boolean;
  stock_online: number | null;
  stock_quantity?: number | null;
};

type CartContextType = {
  cart: CartItem[];
  promo: Promo | null;
  addToCart: (product: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  clearCart: () => void;
  applyPromo: (promo: Promo) => void;
  removePromo: () => void;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
};

const CART_KEY = 'freshlook_cart';
const PROMO_KEY = 'freshlook_promo';

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const hasSyncedInventory = useRef(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      const [storedCart, storedPromo] = await Promise.all([
        AsyncStorage.getItem(CART_KEY),
        AsyncStorage.getItem(PROMO_KEY),
      ]);

      setCart(storedCart ? (JSON.parse(storedCart) as CartItem[]) : []);
      setPromo(storedPromo ? (JSON.parse(storedPromo) as Promo) : null);
      setHydrated(true);
    };

    hydrate().catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => {});
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const persistPromo = async () => {
      if (promo) {
        await AsyncStorage.setItem(PROMO_KEY, JSON.stringify(promo));
      } else {
        await AsyncStorage.removeItem(PROMO_KEY);
      }
    };
    persistPromo().catch(() => {});
  }, [promo, hydrated]);

  useEffect(() => {
    const syncCartWithInventory = async () => {
      if (cart.length === 0) return;

      const cartIds = [...new Set(cart.map((item) => item.id))];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, is_on_sale, sale_price, is_out_of_stock, stock_online')
        .in('id', cartIds);

      if (error || !data) return;

      const productMap = new Map(
        (data as ProductSnapshot[]).map((product) => [product.id, product])
      );

      setCart((prev) =>
        prev.reduce<CartItem[]>((acc, item) => {
          const liveProduct = productMap.get(item.id);
          if (!liveProduct) return acc;

          const availableQuantity = liveProduct.stock_online ?? liveProduct.stock_quantity ?? 0;

          acc.push({
            ...item,
            name: liveProduct.name,
            price: liveProduct.price,
            image: liveProduct.image_url || item.image,
            is_on_sale: liveProduct.is_on_sale,
            sale_price: liveProduct.sale_price,
            is_out_of_stock: liveProduct.is_out_of_stock || availableQuantity <= 0,
            stock_quantity: availableQuantity,
            stock_online: liveProduct.stock_online,
            quantity: availableQuantity > 0 ? Math.min(item.quantity, availableQuantity) : item.quantity,
          });

          return acc;
        }, [])
      );
    };

    if (!hydrated || hasSyncedInventory.current) return;
    hasSyncedInventory.current = true;
    syncCartWithInventory().catch(() => {});
  }, [cart, hydrated]);

  const addToCart = (product: Omit<CartItem, 'quantity'>) => {
    const availableQuantity = product.stock_quantity ?? 0;
    if (product.is_out_of_stock || availableQuantity <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= (existing.stock_quantity ?? availableQuantity)) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const increaseQty = (id: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? item.is_out_of_stock || item.quantity >= (item.stock_quantity ?? item.quantity)
            ? item
            : { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQty = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setPromo(null);
  };

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const price = item.is_on_sale && item.sale_price ? item.sale_price : item.price;
        return sum + price * item.quantity;
      }, 0),
    [cart]
  );

  const discount = useMemo(() => {
    if (!promo) return 0;
    if (promo.discount_type === 'percentage') return (subtotal * promo.discount_value) / 100;
    return promo.discount_value;
  }, [promo, subtotal]);

  const total = Math.max(subtotal - discount, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        promo,
        addToCart,
        removeFromCart,
        increaseQty,
        decreaseQty,
        clearCart,
        applyPromo: setPromo,
        removePromo: () => setPromo(null),
        subtotal,
        discount,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
