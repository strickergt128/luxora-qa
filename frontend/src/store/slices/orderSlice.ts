
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export type Order = {
  subtotal: any;
  tax: any;
  shippingCost: any;
  shippingMethod: string;
  address: string;
  paymentMethod: string; _id:string; items:any[]; totalAmount:number; status:string; createdAt:string; 
};
type State = { list: Order[]; current: Order | null; loading:boolean; };

const initialState: State = { list: [], current: null, loading: false };

export const placeOrder = createAsyncThunk('orders/place', async (payload: { address: string; paymentMethod: 'COD'; }) => {
  const { data } = await api.post('/orders', payload);
  return data;
});

export const fetchMyOrders = createAsyncThunk('orders/my', async () => {
  const { data } = await api.get('/orders/my');
  return data as Order[];
});

export const fetchOrder = createAsyncThunk('orders/one', async (id: string) => {
  const { data } = await api.get(`/orders/${id}`);
  return data as Order;
});

const slice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (b)=>{
    b.addCase(fetchMyOrders.fulfilled, (s,a)=>{ s.list = a.payload; })
     .addCase(fetchOrder.fulfilled, (s,a)=>{ s.current = a.payload; });
  }
});

export default slice.reducer;
