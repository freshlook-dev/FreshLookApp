import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';
import { useAuth } from './AuthContext';

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
  is_active: boolean;
  is_on_sale: boolean;
  sale_price: number | null;
  is_out_of_stock: boolean;
  stock_online: number | null;
  stock_quantity: number | null;
};

type PromoSnapshot = Promo & {
  is_active: boolean;
  expires_at: string | null;
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
  refreshCart: () => Promise<CartItem[]>;
  refreshPromo: () => Promise<Promo | null>;
};

const CART_KEY = 'freshlook_cart';
const PROMO_KEY = 'freshlook_promo';
const cartStorageKey = (userId: string) => `${CART_KEY}:${userId}`;
const promoStorageKey = (userId: string) => `${PROMO_KEY}:${userId}`;

const CartContext = createContext<CartContextType | null>(null);

const optionalStoredNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : value === null
      ? null
      : undefined;

const parseStoredCart = (storedCart: string | null): CartItem[] => {
  if (!storedCart) return [];

  try {
    const parsed: unknown = JSON.parse(storedCart);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value): CartItem[] => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      if (
        typeof item.id !== 'string' ||
        !item.id ||
        typeof item.name !== 'string' ||
        typeof item.price !== 'number' ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return [];
      }

      return [{
        id: item.id,
        name: item.name,
        price: item.price,
        image: typeof item.image === 'string' ? item.image : '',
        quantity: item.quantity,
        is_on_sale: item.is_on_sale === true,
        sale_price: optionalStoredNumber(item.sale_price),
        is_out_of_stock: item.is_out_of_stock === true,
        stock_quantity: optionalStoredNumber(item.stock_quantity),
        stock_online: optionalStoredNumber(item.stock_online),
      }];
    });
  } catch {
    return [];
  }
};

const parseStoredPromo = (storedPromo: string | null): Promo | null => {
  if (!storedPromo) return null;

  try {
    const parsed: unknown = JSON.parse(storedPromo);
    if (!parsed || typeof parsed !== 'object') return null;
    const promo = parsed as Record<string, unknown>;
    if (
      typeof promo.code !== 'string' ||
      !promo.code ||
      (promo.discount_type !== 'percentage' && promo.discount_type !== 'fixed') ||
      typeof promo.discount_value !== 'number' ||
      !Number.isFinite(promo.discount_value) ||
      promo.discount_value < 0 ||
      (promo.discount_type === 'percentage' && promo.discount_value > 100)
    ) {
      return null;
    }

    return {
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
    };
  } catch {
    return null;
  }
};

const synchronizeCartItems = (
  items: CartItem[],
  productMap: Map<string, ProductSnapshot>
) => items.map((item) => {
  const liveProduct = productMap.get(item.id);

  if (!liveProduct) {
    return {
      ...item,
      is_out_of_stock: true,
      stock_quantity: 0,
      stock_online: 0,
    };
  }

  const livePrice = Number(liveProduct.price);
  const liveSalePrice = liveProduct.sale_price == null ? null : Number(liveProduct.sale_price);
  const rawAvailableQuantity = liveProduct.stock_online ?? liveProduct.stock_quantity ?? 0;
  const availableQuantity = Number(rawAvailableQuantity);
  const validCatalogData =
    typeof liveProduct.name === 'string' &&
    liveProduct.name.trim().length > 0 &&
    Number.isFinite(livePrice) &&
    livePrice >= 0 &&
    (!liveProduct.is_on_sale || (
      liveSalePrice != null && Number.isFinite(liveSalePrice) && liveSalePrice >= 0
    )) &&
    Number.isInteger(availableQuantity) &&
    availableQuantity >= 0;
  const unavailable =
    !validCatalogData ||
    liveProduct.is_active !== true ||
    liveProduct.is_out_of_stock ||
    availableQuantity <= 0;

  return {
    ...item,
    name: validCatalogData ? liveProduct.name : item.name,
    price: validCatalogData ? livePrice : item.price,
    image: liveProduct.image_url || item.image,
    is_on_sale: validCatalogData && liveProduct.is_on_sale,
    sale_price: validCatalogData ? liveSalePrice : null,
    is_out_of_stock: unavailable,
    stock_quantity: validCatalogData ? availableQuantity : 0,
    stock_online: validCatalogData ? liveProduct.stock_online : 0,
    quantity: validCatalogData && availableQuantity > 0
      ? Math.min(item.quantity, availableQuantity)
      : item.quantity,
  };
});

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const hasSyncedCommerce = useRef(false);
  const cartRef = useRef<CartItem[]>([]);
  const promoRef = useRef<Promo | null>(null);
  const hydratedRef = useRef(false);
  const storageUserIdRef = useRef<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageUserId, setStorageUserId] = useState<string | null>(null);

  const setCartAndRef = useCallback((update: (current: CartItem[]) => CartItem[]) => {
    setCart((current) => {
      const next = update(current);
      cartRef.current = next;
      return next;
    });
  }, []);

  const setPromoAndRef = useCallback((update: (current: Promo | null) => Promo | null) => {
    setPromo((current) => {
      const next = update(current);
      promoRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    hasSyncedCommerce.current = false;
    hydratedRef.current = false;
    storageUserIdRef.current = null;
    cartRef.current = [];
    promoRef.current = null;
    setStorageUserId(null);
    setHydrated(false);
    setCart([]);
    setPromo(null);

    // Global legacy keys cannot be attributed safely to the current account.
    void Promise.all([
      AsyncStorage.removeItem(CART_KEY),
      AsyncStorage.removeItem(PROMO_KEY),
    ]).catch(() => {});

    if (!userId) {
      return () => {
        active = false;
      };
    }

    const hydrate = async () => {
      const [storedCart, storedPromo] = await Promise.all([
        AsyncStorage.getItem(cartStorageKey(userId)),
        AsyncStorage.getItem(promoStorageKey(userId)),
      ]);

      if (!active) return;

      const nextCart = parseStoredCart(storedCart);
      const nextPromo = parseStoredPromo(storedPromo);
      cartRef.current = nextCart;
      promoRef.current = nextPromo;
      hydratedRef.current = true;
      storageUserIdRef.current = userId;
      setCart(nextCart);
      setPromo(nextPromo);
      setStorageUserId(userId);
      setHydrated(true);
    };

    hydrate().catch(() => {
      if (!active) return;
      hydratedRef.current = true;
      storageUserIdRef.current = userId;
      setStorageUserId(userId);
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !storageUserId || storageUserId !== userId) return;
    AsyncStorage.setItem(cartStorageKey(storageUserId), JSON.stringify(cart)).catch(() => {});
  }, [cart, hydrated, storageUserId, userId]);

  useEffect(() => {
    if (!hydrated || !storageUserId || storageUserId !== userId) return;
    const persistPromo = async () => {
      if (promo) {
        await AsyncStorage.setItem(promoStorageKey(storageUserId), JSON.stringify(promo));
      } else {
        await AsyncStorage.removeItem(promoStorageKey(storageUserId));
      }
    };
    persistPromo().catch(() => {});
  }, [promo, hydrated, storageUserId, userId]);

  const refreshCart = useCallback(async () => {
    const currentCart = cartRef.current;
    const requestUserId = userId;
    if (
      !requestUserId ||
      !hydratedRef.current ||
      storageUserIdRef.current !== requestUserId ||
      currentCart.length === 0
    ) {
      return [];
    }

    const cartIds = [...new Set(currentCart.map((item) => item.id))];
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, image_url, is_active, is_on_sale, sale_price, is_out_of_stock, stock_quantity, stock_online')
      .in('id', cartIds);

    if (error) throw error;

    if (storageUserIdRef.current !== requestUserId) return [];

    const productMap = new Map(
      ((data as ProductSnapshot[] | null) ?? []).map((product) => [product.id, product])
    );
    const refreshedCart = synchronizeCartItems(currentCart, productMap);
    const requestedIds = new Set(cartIds);

    setCartAndRef((current) => {
      if (storageUserIdRef.current !== requestUserId) return current;
      const requestedItems = current.filter((item) => requestedIds.has(item.id));
      const synchronizedItems = synchronizeCartItems(requestedItems, productMap);
      const synchronizedById = new Map(synchronizedItems.map((item) => [item.id, item]));
      return current.map((item) => synchronizedById.get(item.id) ?? item);
    });

    return refreshedCart;
  }, [setCartAndRef, userId]);

  const refreshPromo = useCallback(async () => {
    const currentPromo = promoRef.current;
    const requestUserId = userId;
    if (
      !requestUserId ||
      !hydratedRef.current ||
      storageUserIdRef.current !== requestUserId ||
      !currentPromo
    ) {
      return null;
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .select('code, discount_type, discount_value, is_active, expires_at')
      .eq('code', currentPromo.code)
      .maybeSingle();

    if (error) throw error;

    if (storageUserIdRef.current !== requestUserId) return null;

    const livePromo = data as PromoSnapshot | null;
    const expiryTimestamp = livePromo?.expires_at == null
      ? null
      : Date.parse(livePromo.expires_at);
    const expired = expiryTimestamp != null &&
      (!Number.isFinite(expiryTimestamp) || expiryTimestamp <= Date.now());
    const validDiscount = !!livePromo &&
      (livePromo.discount_type === 'percentage' || livePromo.discount_type === 'fixed') &&
      Number.isFinite(livePromo.discount_value) &&
      livePromo.discount_value >= 0 &&
      (livePromo.discount_type !== 'percentage' || livePromo.discount_value <= 100);
    const nextPromo = livePromo?.is_active === true && validDiscount && !expired
      ? {
          code: livePromo.code,
          discount_type: livePromo.discount_type,
          discount_value: livePromo.discount_value,
        }
      : null;

    setPromoAndRef((current) =>
      storageUserIdRef.current === requestUserId && current?.code === currentPromo.code
        ? nextPromo
        : current
    );
    return nextPromo;
  }, [setPromoAndRef, userId]);

  useEffect(() => {
    if (!hydrated || !userId || storageUserId !== userId || hasSyncedCommerce.current) return;
    hasSyncedCommerce.current = true;
    Promise.all([refreshCart(), refreshPromo()]).catch(() => {});
  }, [hydrated, refreshCart, refreshPromo, storageUserId, userId]);

  useEffect(() => {
    if (!hydrated || !userId || storageUserId !== userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Promise.all([refreshCart(), refreshPromo()]).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [hydrated, refreshCart, refreshPromo, storageUserId, userId]);

  const storageReady = !!userId && hydrated && storageUserId === userId;
  const ownsCurrentStorage = () =>
    !!userId && hydratedRef.current && storageUserIdRef.current === userId;

  const addToCart = (product: Omit<CartItem, 'quantity'>) => {
    if (!ownsCurrentStorage()) return;
    const availableQuantity = product.stock_quantity ?? 0;
    if (product.is_out_of_stock || availableQuantity <= 0) return;

    setCartAndRef((prev) => {
      if (storageUserIdRef.current !== userId) return prev;
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= availableQuantity) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, ...product, quantity: item.quantity + 1 } : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    if (!ownsCurrentStorage()) return;
    setCartAndRef((prev) =>
      storageUserIdRef.current === userId ? prev.filter((item) => item.id !== id) : prev
    );
  };

  const increaseQty = (id: string) => {
    if (!ownsCurrentStorage()) return;
    setCartAndRef((prev) => storageUserIdRef.current === userId
      ? prev.map((item) =>
          item.id === id
            ? item.is_out_of_stock || item.quantity >= (item.stock_quantity ?? item.quantity)
              ? item
              : { ...item, quantity: item.quantity + 1 }
            : item
        )
      : prev
    );
  };

  const decreaseQty = (id: string) => {
    if (!ownsCurrentStorage()) return;
    setCartAndRef((prev) => storageUserIdRef.current === userId
      ? prev
          .map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
          .filter((item) => item.quantity > 0)
      : prev
    );
  };

  const clearCart = () => {
    if (!ownsCurrentStorage()) return;
    setCartAndRef((current) => storageUserIdRef.current === userId ? [] : current);
    setPromoAndRef((current) => storageUserIdRef.current === userId ? null : current);
  };

  const visibleCart = storageReady ? cart : [];
  const visiblePromo = storageReady ? promo : null;

  const subtotal = useMemo(
    () =>
      visibleCart.reduce((sum, item) => {
        const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
        return sum + price * item.quantity;
      }, 0),
    [visibleCart]
  );

  const discount = useMemo(() => {
    if (!visiblePromo) return 0;
    const calculated = visiblePromo.discount_type === 'percentage'
      ? (subtotal * visiblePromo.discount_value) / 100
      : visiblePromo.discount_value;
    return Math.min(calculated, subtotal);
  }, [visiblePromo, subtotal]);

  const total = Math.max(subtotal - discount, 0);
  const itemCount = visibleCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart: visibleCart,
        promo: visiblePromo,
        addToCart,
        removeFromCart,
        increaseQty,
        decreaseQty,
        clearCart,
        applyPromo: (nextPromo) => {
          if (ownsCurrentStorage()) {
            setPromoAndRef((current) =>
              storageUserIdRef.current === userId ? nextPromo : current
            );
          }
        },
        removePromo: () => {
          if (ownsCurrentStorage()) {
            setPromoAndRef((current) =>
              storageUserIdRef.current === userId ? null : current
            );
          }
        },
        subtotal,
        discount,
        total,
        itemCount,
        refreshCart,
        refreshPromo,
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
