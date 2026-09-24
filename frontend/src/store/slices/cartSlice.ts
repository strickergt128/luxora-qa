import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from "../../utils/api";
import { trackAddToCart } from "../../utils/analytics";

export interface CartItem {
  _id: string;
  product: {
    _id: string;
    title: string;
    price: number;
    images?: any[];
  };
  qty: number;
  priceAtAdd?: number;
}

export type AppliedCoupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
} | null;

interface CartState {
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  appliedCoupon: AppliedCoupon;
  couponError: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  items: [],
  subtotal: 0,
  discount: 0,
  discountedSubtotal: 0,
  appliedCoupon: null,
  couponError: null,
  loading: false,
  error: null,
};

// --- Async thunks ---
export const fetchCart = createAsyncThunk("cart/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/cart");
    return data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data || "We could not load your cart");
  }
});

export const addToCart = createAsyncThunk(
  "cart/add",
  async (payload: { productId: string; qty: number }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/cart", payload);
      // fire-and-forget analytics (do not block UX)
      trackAddToCart(payload.productId);
      return data; // { items, subtotal }
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "We could not add this item");
    }
  }
);

export const removeFromCart = createAsyncThunk(
  "cart/remove",
  async (id: string, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/cart/${id}`);
      return data; // { items, subtotal }
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "We could not remove this item");
    }
  }
);

export const updateCartQty = createAsyncThunk(
  "cart/updateQty",
  async (payload: { itemId: string; qty: number }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/cart/${payload.itemId}`, { qty: payload.qty });
      return data; // { items, subtotal }
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "We could not update quantity");
    }
  }
);

// Coupons
export const applyCoupon = createAsyncThunk(
  "cart/applyCoupon",
  async (code: string, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/cart/apply-coupon", { code });
      return data; // { items, appliedCoupon, subtotal, discount, discountedSubtotal }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "We could not apply that code");
    }
  }
);

export const removeCoupon = createAsyncThunk(
  "cart/removeCoupon",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/cart/remove-coupon");
      return data; // { items, subtotal, discount:0, discountedSubtotal:subtotal }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "We could not remove that code");
    }
  }
);

// --- Slice ---
const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    increaseQty: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i._id === action.payload);
      if (item) item.qty += 1;
    },
    decreaseQty: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i._id === action.payload);
      if (item && item.qty > 1) item.qty -= 1;
    },
    clearCart: (state) => {
      state.items = [];
      state.subtotal = 0;
      state.discount = 0;
      state.discountedSubtotal = 0;
      state.appliedCoupon = null;
      state.couponError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCart
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        const d = action.payload || {};
        state.items = d.items || [];
        state.subtotal = Number(d.subtotal || 0);
        state.discount = Number(d.discount || 0);
        state.discountedSubtotal = Number(
          d.discountedSubtotal || Math.max(0, state.subtotal - state.discount)
        );
        state.appliedCoupon = d.appliedCoupon || null;
        state.couponError = d.couponError || null;
      })
      .addCase(fetchCart.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload || "We could not load your cart";
      })

      // addToCart
      .addCase(addToCart.fulfilled, (state, action) => {
        const d = action.payload || {};
        state.items = d.items || state.items;
        state.subtotal = Number(d.subtotal ?? state.subtotal);
        state.discountedSubtotal = Math.max(0, state.subtotal - state.discount);
      })

      // removeFromCart
      .addCase(removeFromCart.fulfilled, (state, action) => {
        const d = action.payload || {};
        state.items = d.items || [];
        state.subtotal = Number(d.subtotal || 0);
        state.discountedSubtotal = Math.max(0, state.subtotal - state.discount);
      })

      // updateCartQty
      .addCase(updateCartQty.fulfilled, (state, action) => {
        const d = action.payload || {};
        state.items = d.items || state.items;
        state.subtotal = Number(d.subtotal ?? state.subtotal);
        state.discountedSubtotal = Math.max(0, state.subtotal - state.discount);
      })

      // applyCoupon
      .addCase(applyCoupon.fulfilled, (state, action) => {
        const d = action.payload || {};
        state.items = d.items || state.items;
        state.appliedCoupon = d.appliedCoupon || null;
        state.subtotal = Number(d.subtotal || 0);
        state.discount = Number(d.discount || 0);
        state.discountedSubtotal = Number(
          d.discountedSubtotal || Math.max(0, state.subtotal - state.discount)
        );
        state.couponError = null;
      })
      .addCase(applyCoupon.rejected, (state, action: any) => {
        state.couponError = action.payload || "Enter a valid code";
      })

      // removeCoupon
      .addCase(removeCoupon.fulfilled, (state, action) => {
        const d = action.payload || {};
        state.items = d.items || state.items;
        state.subtotal = Number(d.subtotal || 0);
        state.discount = 0;
        state.discountedSubtotal = Number(d.discountedSubtotal || state.subtotal);
        state.appliedCoupon = null;
        state.couponError = null;
      });
  },
});

export const { increaseQty, decreaseQty, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
