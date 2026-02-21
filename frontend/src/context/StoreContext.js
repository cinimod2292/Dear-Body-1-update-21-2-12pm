import React, { createContext, useContext, useReducer, useCallback } from 'react';

const StoreContext = createContext(null);

const initialState = {
  cart: [],
  wishlist: [],
  searchQuery: '',
  orderHistory: [],
  currentOrder: null,
  isCartOpen: false,
};

function storeReducer(state, action) {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existing = state.cart.find(item => item.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(item => item.id !== action.payload) };
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return { ...state, cart: state.cart.filter(item => item.id !== action.payload.id) };
      }
      return {
        ...state,
        cart: state.cart.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'TOGGLE_WISHLIST': {
      const exists = state.wishlist.find(item => item.id === action.payload.id);
      if (exists) {
        return { ...state, wishlist: state.wishlist.filter(item => item.id !== action.payload.id) };
      }
      return { ...state, wishlist: [...state.wishlist, action.payload] };
    }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'PLACE_ORDER': {
      const order = {
        id: `ORD-${Date.now()}`,
        items: [...state.cart],
        total: action.payload.total,
        date: new Date().toISOString(),
        status: 'confirmed',
        shipping: action.payload.shipping,
        payment: action.payload.payment,
      };
      return {
        ...state,
        cart: [],
        orderHistory: [...state.orderHistory, order],
        currentOrder: order,
      };
    }
    case 'TOGGLE_CART':
      return { ...state, isCartOpen: !state.isCartOpen };
    case 'CLOSE_CART':
      return { ...state, isCartOpen: false };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(storeReducer, initialState);

  const addToCart = useCallback((product) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
  }, []);

  const removeFromCart = useCallback((id) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const toggleWishlist = useCallback((product) => {
    dispatch({ type: 'TOGGLE_WISHLIST', payload: product });
  }, []);

  const setSearch = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const placeOrder = useCallback((orderDetails) => {
    dispatch({ type: 'PLACE_ORDER', payload: orderDetails });
  }, []);

  const toggleCart = useCallback(() => {
    dispatch({ type: 'TOGGLE_CART' });
  }, []);

  const closeCart = useCallback(() => {
    dispatch({ type: 'CLOSE_CART' });
  }, []);

  const cartTotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const isInWishlist = useCallback((id) => state.wishlist.some(item => item.id === id), [state.wishlist]);

  return (
    <StoreContext.Provider value={{
      ...state,
      cartTotal,
      cartCount,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      isInWishlist,
      setSearch,
      placeOrder,
      toggleCart,
      closeCart,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
