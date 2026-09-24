import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../utils/api";
import { ReactNode } from "react";

// Keep this flexible to match backend payloads
export type ProductImage = string | { url?: string; alt?: string };
export type ProductAttribute = { key: string; value: string };

export type Product = {
  description: ReactNode;
  _id: string;
  title: string;
  price: number;
  discountPrice?: number;
  images?: ProductImage[];
  videoUrl: string | undefined;
  avgRating?: number;
  stock?: number;
  sku?: string;
  brand?: string;
  tags?: string[];
  attributes?: ProductAttribute[];
  seo?: { title?: string; description?: string };
  isSponsored?: boolean;
};

type State = {
  list: Product[];
  current: Product | null;
  loading: boolean;
  error: string | null;
};

const initialState: State = {
  list: [],
  current: null,
  loading: false,
  error: null,
};

export const fetchProducts = createAsyncThunk(
  "products/fetch",
  async (params?: Record<string, any>) => {
    const query: Record<string, any> = { ...params };

    // Map frontend sort values to backend "field:direction"
    if (query.sort) {
      switch (query.sort) {
        case "priceAsc":
          query.sort = "price:asc";
          break;
        case "priceDesc":
          query.sort = "price:desc";
          break;
        case "newest":
          query.sort = "createdAt:desc";
          break;
        default:
          delete query.sort;
      }
    }

    if (query.priceRange) {
      const [min, max] = String(query.priceRange).split(",");
      if (min) query.minPrice = min;
      if (max) query.maxPrice = max;
      delete query.priceRange;
    }

    const { data } = await api.get("/products", { params: query });
    return data.items || data.products || [];
  }
);

export const fetchProductById = createAsyncThunk(
  "products/fetchOne",
  async (id: string) => {
    const { data } = await api.get(`/products/${id}`);
    return data as Product;
  }
);

const slice = createSlice({
  name: "products",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchProducts.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchProducts.fulfilled, (s, a) => {
      s.loading = false;
      s.list = a.payload as Product[];
    });
    b.addCase(fetchProducts.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error.message || "Failed";
    });
    b.addCase(fetchProductById.fulfilled, (s, a) => {
      s.current = a.payload as Product;
    });
  },
});

export default slice.reducer;
