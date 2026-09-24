import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from "../../utils/api";
import { AppDispatch } from "../../store";

export interface Address {
  _id: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "seller" | "admin" | "subadmin";
  accessToken?: string;
  addresses?: Address[];
  sellerRequest?: "none" | "pending" | "approved" | "rejected";
  seller?: { approved?: boolean; approvedAt?: string };
  permissions?: string[];
}

export const verifyAdmin2FA = createAsyncThunk(
  "auth/verifyAdmin2FA",
  async (payload: { challenge: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/admin-2fa/verify", payload);
      const flat = { ...data.user, accessToken: data.accessToken } as User;
      setStoredUser(flat);
      return flat;
    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data?.message || "Invalid 2FA code"
      );
    }
  }
);

export const enrollInit2FA = createAsyncThunk(
  "auth/enrollInit2FA",
  async (payload: { challenge: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/admin-2fa/enroll-init", payload);
      return data;
    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to init enrollment"
      );
    }
  }
);

export const enrollVerify2FA = createAsyncThunk(
  "auth/enrollVerify2FA",
  async (payload: { challenge: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/admin-2fa/enroll-verify", payload);
      const flat = { ...data.user, accessToken: data.accessToken } as User;
      setStoredUser(flat);
      return flat;
    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data?.message || "Invalid enrollment code"
      );
    }
  }
);

type MFAMode = "verify" | "enroll" | "enroll-verify" | null;

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  mfa: { mode: MFAMode; challenge: string | null };
}

const getStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem("user") || "null");
    if (!raw) return null;
    // Never hydrate access token from localStorage.
    if (raw.accessToken) delete raw.accessToken;
    return raw;
  } catch {
    return null;
  }
};
const setStoredUser = (user: User | null) => {
  if (typeof window === "undefined") return;
  if (!user) localStorage.removeItem("user");
  else {
    // Persist profile data only; keep access token in-memory.
    const safe = { ...user };
    delete safe.accessToken;
    localStorage.setItem("user", JSON.stringify(safe));
  }
};

const initialState: AuthState = {
  user: getStoredUser(),
  loading: false,
  error: null,
  hydrated: false,
  mfa: { mode: null, challenge: null },
};

export const refreshAccessToken = createAsyncThunk(
  "auth/refresh",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        "/auth/refresh",
        {},
        { headers: { "Cache-Control": "no-cache" } }
      );
      const stored = getStoredUser();
      if (!stored) return rejectWithValue("No session");
      const next = { ...stored, accessToken: data.accessToken } as User;
      setStoredUser(next);
      return data.accessToken as string;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || "Refresh failed");
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async (
    payload: { email: string; password: string; captchaToken?: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const { data } = await api.post("/auth/login", payload);
      const mfaFlat = {
        twoFARequired: data?.twoFARequired,
        twoFAEnrollRequired: data?.twoFAEnrollRequired,
        challenge: data?.challenge,
      };
      const mfa = data?.mfa || mfaFlat;

      if (mfa?.twoFARequired && mfa?.challenge) {
        dispatch(setMfa({ mode: "verify", challenge: mfa.challenge }));
        return rejectWithValue({ mfa });
      }
      if (mfa?.twoFAEnrollRequired && mfa?.challenge) {
        dispatch(setMfa({ mode: "enroll", challenge: mfa.challenge }));
        return rejectWithValue({ mfa });
      }

      const flat = { ...data.user, accessToken: data.accessToken } as User;
      setStoredUser(flat);
      return flat;
    } catch (err: any) {
      const d = err?.response?.data || {};
      const mfaFlat = {
        twoFARequired: d?.twoFARequired,
        twoFAEnrollRequired: d?.twoFAEnrollRequired,
        challenge: d?.challenge,
      };
      const mfa = d?.mfa || mfaFlat;

      if (mfa?.twoFARequired && mfa?.challenge) {
        dispatch(setMfa({ mode: "verify", challenge: mfa.challenge }));
        return rejectWithValue({ mfa });
      }
      if (mfa?.twoFAEnrollRequired && mfa?.challenge) {
        dispatch(setMfa({ mode: "enroll", challenge: mfa.challenge }));
        return rejectWithValue({ mfa });
      }

      return rejectWithValue(d?.message || "Login failed");
    }
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async (
    payload: {
      name: string;
      email: string;
      password: string;
      captchaToken?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      const flat = { ...data.user, accessToken: data.accessToken } as User;
      setStoredUser(flat);
      return flat;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Register failed");
    }
  }
);

export const logoutAsync = createAsyncThunk("auth/logout", async () => {
  try {
    await api.post("/auth/logout");
  } catch {}
  setStoredUser(null);
});

export const fetchMe = createAsyncThunk(
  "auth/me",
  async (_, { dispatch, rejectWithValue }) => {
    const tryGetMe = async (accessToken?: string) => {
      const config = accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : {};
      const { data } = await api.get("/auth/me", config);
      const stored: User | null = getStoredUser();
      const token = accessToken || stored?.accessToken || "";
      const flat = { ...data, accessToken: token } as User;
      setStoredUser(flat);
      return flat;
    };

    try {
      const stored = getStoredUser();
      if (!stored?.accessToken) {
        const token = await (dispatch as any)(refreshAccessToken()).unwrap();
        return await tryGetMe(token);
      }
      return await tryGetMe();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        try {
          const token = await (dispatch as any)(refreshAccessToken()).unwrap();
          return await tryGetMe(token);
        } catch (e: any) {
          setStoredUser(null);
          return rejectWithValue(e?.message || "Not authenticated");
        }
      }
      return rejectWithValue(
        err?.response?.data?.message || "Failed to fetch profile"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.hydrated = true;
      setStoredUser(action.payload);
      state.mfa = { mode: null, challenge: null };
    },
    logout(state) {
      state.user = null;
      state.hydrated = true;
      setStoredUser(null);
      state.mfa = { mode: null, challenge: null };
    },
    setAccessToken(state, action: PayloadAction<string>) {
      if (state.user) {
        state.user.accessToken = action.payload;
        setStoredUser(state.user);
      }
    },
    setMfa(
      state,
      action: PayloadAction<{ mode: MFAMode; challenge: string | null }>
    ) {
      state.mfa = action.payload;
    },
    clearMfa(state) {
      state.mfa = { mode: null, challenge: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload;
        s.hydrated = true;
      })
      .addCase(login.rejected, (s, a) => {
        s.loading = false;
        const p: any = a.payload;
        if (!p || !p.mfa) {
          s.error = (a.payload as string) || "Login failed";
        } else {
          s.error = null;
        }
        s.hydrated = true;
      })
      .addCase(register.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(register.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload;
        s.hydrated = true;
      })
      .addCase(register.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
        s.hydrated = true;
      })
      .addCase(logoutAsync.fulfilled, (s) => {
        s.user = null;
        s.hydrated = true;
        s.mfa = { mode: null, challenge: null };
      })
      .addCase(fetchMe.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchMe.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload;
        s.hydrated = true;
      })
      .addCase(fetchMe.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
        s.hydrated = true;
      })
      .addCase(refreshAccessToken.fulfilled, (s, a) => {
        if (s.user) s.user.accessToken = a.payload as string;
      })
      .addCase(verifyAdmin2FA.fulfilled, (s, a) => {
        s.user = a.payload;
        s.mfa = { mode: null, challenge: null };
        s.hydrated = true;
      })
      .addCase(enrollVerify2FA.fulfilled, (s, a) => {
        s.user = a.payload;
        s.mfa = { mode: null, challenge: null };
        s.hydrated = true;
      });
  },
});

export const { setAccessToken, loginSuccess, logout, setMfa, clearMfa } =
  authSlice.actions;
export default authSlice.reducer;
