import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../utils/api";
import type { Product } from "./productSlice";

type State = { items: Product[]; loading: boolean; error: string | null };
const initialState: State = { items: [], loading: false, error: null };

export const fetchWishlist = createAsyncThunk("wishlist/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/wishlist"); // backend returns populated array
    return data as Product[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || "Failed to fetch wishlist");
  }
});

export const addToWishlist = createAsyncThunk("wishlist/add", async (productId: string, { rejectWithValue }) => {
  try {
    await api.post("/wishlist", { productId });
    const { data } = await api.get("/wishlist");
    return data as Product[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || "Failed to add");
  }
});

export const removeFromWishlist = createAsyncThunk("wishlist/remove", async (productId: string, { rejectWithValue }) => {
  try {
    await api.delete(`/wishlist/${productId}`);
    const { data } = await api.get("/wishlist");
    return data as Product[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || "Failed to remove");
  }
});

const slice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchWishlist.pending, (s) => { s.loading = true; s.error = null; })
     .addCase(fetchWishlist.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
     .addCase(fetchWishlist.rejected, (s, a: any) => { s.loading = false; s.error = a.payload; })
     .addCase(addToWishlist.fulfilled, (s, a) => { s.items = a.payload; })
     .addCase(removeFromWishlist.fulfilled, (s, a) => { s.items = a.payload; });
  },
});

export default slice.reducer;