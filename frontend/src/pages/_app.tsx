import type { AppProps } from "next/app";
import { Provider, useDispatch, useSelector } from "react-redux";
import store, { AppDispatch, RootState } from "../store";
import { useEffect, useRef, useState } from "react";
import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import api from "../utils/api";
import {
  setAccessToken,
  logout,
  loginSuccess,
  fetchMe,
} from "../store/slices/authSlice";
import { fetchCart } from "../store/slices/cartSlice";
import { fetchWishlist } from "../store/slices/wishlistSlice";
import Router from "next/router";
import NProgress from "nprogress";
import GlobalRouteGuard from "../components/layout/GlobalRouteGuard";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

// Client-only wrapper (prevents SSR mismatch)
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

function RouteProgress() {
  useEffect(() => {
    NProgress.configure({
      showSpinner: false,
      trickleSpeed: 120,
      minimum: 0.08,
    });
    const start = () => NProgress.start();
    const done = () => NProgress.done();

    Router.events.on("routeChangeStart", start);
    Router.events.on("routeChangeComplete", done);
    Router.events.on("routeChangeError", done);
    return () => {
      Router.events.off("routeChangeStart", start);
      Router.events.off("routeChangeComplete", done);
      Router.events.off("routeChangeError", done);
    };
  }, []);
  return null;
}

function decodeExp(token?: string): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function AppInitializer() {
  const dispatch = useDispatch<AppDispatch>();
  const doneRef = useRef(false);
  const token = useSelector((s: RootState) => s.auth.user?.accessToken);
  const userId = useSelector((s: RootState) => s.auth.user?._id);

  // 1. Restore Auth from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        dispatch(loginSuccess(JSON.parse(stored)));
      } catch {
        localStorage.removeItem("user");
      }
    }
  }, [dispatch]);

  // 2. Fetch Me (Hydrate Once)
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    dispatch(fetchMe());
  }, [dispatch]);

  // 3. Auto Refresh Token
  useEffect(() => {
    if (!token) return;
    const exp = decodeExp(token);
    if (!exp) return;
    const msToExp = exp * 1000 - Date.now();
    const msToRefresh = Math.max(5_000, msToExp - 60_000);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        dispatch(setAccessToken(data.accessToken));
      } catch {
        dispatch(logout());
        if (typeof window !== "undefined") window.location.href = "/auth/login";
      }
    }, msToRefresh);
    return () => clearTimeout(t);
  }, [token, dispatch]);

  // 4. Fetch Cart & Wishlist
  useEffect(() => {
    if (userId) {
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    }
  }, [userId, dispatch]);

  return null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
        <div className={`${manrope.variable} ${cormorant.variable} ${manrope.className} flex min-h-screen flex-col bg-background text-foreground`}>
          <ClientOnly>
            <RouteProgress />
          </ClientOnly>
          <AppInitializer />

          <ClientOnly>
            <Header />
          </ClientOnly>

          <main className="flex-1">
            <GlobalRouteGuard>
              <Component {...pageProps} />
            </GlobalRouteGuard>
            <ClientOnly>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 2400,
                  style: {
                    background: "#fffaf1",
                    color: "#141b2a",
                    border: "1px solid #d3c8b5",
                    borderRadius: "8px",
                    boxShadow: "0 18px 50px rgba(26,31,44,0.14)",
                  },
                  success: {
                    iconTheme: {
                      primary: "#297f58",
                      secondary: "#fffaf1",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#cc1a39",
                      secondary: "#fffaf1",
                    },
                  },
                }}
              />
            </ClientOnly>
          </main>

          <ClientOnly>
            <Footer />
          </ClientOnly>
        </div>
      </ThemeProvider>
    </Provider>
  );
}
