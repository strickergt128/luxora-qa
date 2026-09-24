import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { removeFromWishlist } from "../store/slices/wishlistSlice";
import ProductCard from "../components/products/ProductCard";
import { HeartIcon, LinkIcon } from "@heroicons/react/24/outline";
import api from "../utils/api";
import { toast } from "react-hot-toast";

export default function WishlistPage() {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((s: RootState) => s.wishlist.items ?? []);
  const userId = useSelector((s: RootState) => s.auth.user?._id);

  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const shareUrl = useMemo(() => {
    if (!shareId) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wishlist/${shareId}`;
  }, [shareId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setStatusLoading(false);
        return;
      }
      setStatusLoading(true);
      try {
        const { data } = await api.get("/wishlist/share/status");
        if (cancelled) return;
        setShareEnabled(!!data?.enabled);
        setShareId(data?.id || null);
      } catch {
        if (!cancelled) {
          setShareEnabled(false);
          setShareId(null);
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      if (!userId) {
        setAlertsLoading(false);
        return;
      }
      setAlertsLoading(true);
      try {
        const { data } = await api.get("/users/me/alerts/price-drop");
        if (cancelled) return;
        setAlertsEnabled(!!data?.enabled);
      } catch {
        if (!cancelled) setAlertsEnabled(false);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }
    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const enableShare = async () => {
    try {
      const { data } = await api.post("/wishlist/share/enable");
      setShareEnabled(!!data?.enabled);
      setShareId(data?.id || null);
      toast.success("Share link is ready");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not create a share link");
    }
  };

  const disableShare = async () => {
    try {
      const { data } = await api.post("/wishlist/share/disable");
      setShareEnabled(!!data?.enabled);
      setShareId(null);
      toast.success("Share link turned off");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not turn off sharing");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("We could not copy the link");
    }
  };

  const toggleAlerts = async () => {
    try {
      const { data } = await api.post("/users/me/alerts/price-drop", {
        enabled: !alertsEnabled,
      });
      setAlertsEnabled(!!data?.enabled);
      toast.success(
        data?.enabled
          ? "Price alerts turned on"
          : "Price alerts turned off"
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not update your alerts");
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-12 max-w-xl mx-auto flex flex-col items-center rounded-xl">
          <HeartIcon className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h2 className="display-font text-3xl font-semibold uppercase tracking-wide text-foreground mb-4">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Save items here so you can compare them and buy when you are ready.
          </p>
          <Link
            href="/products"
            className="btn-primary px-8 py-3 block max-w-xs mx-auto text-center"
          >
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 border-b border-border/40 pb-6">
        <h1 className="display-font text-4xl font-semibold tracking-wide text-foreground">Saved items</h1>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price alerts</span>
          {alertsLoading ? (
            <div className="h-5 w-10 bg-secondary border border-border/40 rounded-full animate-pulse" />
          ) : (
            <button
              onClick={toggleAlerts}
              className={`inline-flex w-10 h-5 rounded-full transition ${
                alertsEnabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
              }`}
              aria-pressed={alertsEnabled}
              title={alertsEnabled ? "Turn off alerts" : "Turn on alerts"}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${
                  alertsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {statusLoading ? (
            <div className="h-10 w-[320px] bg-card border border-border/40 rounded-md animate-pulse" />
          ) : !shareEnabled ? (
            <button
              onClick={enableShare}
              className="btn-primary text-xs px-4 py-2"
            >
              Share wishlist
            </button>
          ) : (
            <>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="w-[260px] sm:w-[340px] bg-card/60 border border-border/80 rounded-md px-3 py-2 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/30 text-xs"
                />
                <button
                  onClick={copyLink}
                  className="btn px-3 py-2 text-foreground hover:bg-secondary/40 transition-colors"
                  title="Copy link"
                >
                  <LinkIcon className="w-4 h-4 text-foreground" />
                </button>
              </div>
              <button
                onClick={disableShare}
                className="btn text-xs px-4 py-2"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((p) => (
          <div key={p._id} className="relative group bg-card/60 border border-border/40 shadow-soft rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-soft hover:-translate-y-1">
            <ProductCard p={p} />
            <div className="absolute top-2 right-2">
              <button
                onClick={() => dispatch(removeFromWishlist(p._id))}
                className="border border-rose-500/30 bg-rose-500/10 text-rose-500 p-2 rounded-md hover:bg-rose-500 hover:text-white transition-all duration-200 z-10"
                title="Remove from saved items"
              >
                <HeartIcon className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
