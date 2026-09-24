import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from "../../utils/api";

export interface Review {
  _id: string;
  product: string;
  user: { _id: string; name: string; email?: string };
  rating: number;
  comment: string;
  createdAt: string;
  // NEW
  media?: {
    images?: { url: string; alt?: string }[];
    videoUrl?: string;
  };
  verifiedPurchase?: boolean;
}

interface ReviewState {
  list: Review[];
  loading: boolean;
  error: string | null;
}

const initialState: ReviewState = { list: [], loading: false, error: null };

export const fetchReviews = createAsyncThunk<Review[], string>(
  "reviews/fetch",
  async (productId, thunkAPI) => {
    try {
      const { data } = await api.get(`/reviews/${productId}`);
      return data as Review[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.message || "Failed to fetch reviews"
      );
    }
  }
);

// Accept FormData for media
export const addReview = createAsyncThunk<Review, FormData>(
  "reviews/add",
  async (form, thunkAPI) => {
    try {
      const { data } = await api.post(`/reviews`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data as Review;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.message || "Failed to add review"
      );
    }
  }
);

const reviewSlice = createSlice({
  name: "reviews",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchReviews.pending, (s) => {
      s.loading = true;
      s.error = null;
    })
      .addCase(
        fetchReviews.fulfilled,
        (s, a: PayloadAction<Review[]>) => {
          s.loading = false;
          s.list = a.payload;
        }
      )
      .addCase(fetchReviews.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(addReview.fulfilled, (s, a: PayloadAction<Review>) => {
        s.list.unshift(a.payload); // newest first
      });
  },
});

export default reviewSlice.reducer;