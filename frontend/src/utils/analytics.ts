import api from "./api";

export type SalesPoint = { date: string; orders: number; revenue: number };

// Format YYYY-MM-DD in UTC
const fmtUTC = (d: Date) => d.toISOString().slice(0, 10);

// Today midnight UTC
const todayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export function fillSalesSeries(days: number, raw: SalesPoint[]): SalesPoint[] {
  const map = new Map<string, SalesPoint>();
  for (const r of raw) map.set(r.date, r);
  const out: SalesPoint[] = [];
  const start = todayUTC();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() - i);
    const key = fmtUTC(d);
    out.push(map.get(key) || { date: key, orders: 0, revenue: 0 });
  }
  return out;
}

export function fillSalesSeriesRange(from: string, to: string, raw: SalesPoint[]): SalesPoint[] {
  const map = new Map<string, SalesPoint>();
  for (const r of raw) map.set(r.date, r);

  // interpret input as UTC dates
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  const out: SalesPoint[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = fmtUTC(d);
    out.push(map.get(key) || { date: key, orders: 0, revenue: 0 });
  }
  return out;
}

/* ---------------- Funnel Tracking (Client) ---------------- */
type TrackEvent = "view" | "cart" | "checkout";
const SESSION_KEY = "lx_session_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-mixed-operators
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = uuid();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// in-memory throttle to avoid spamming same event repeatedly
const sentCache = new Map<string, number>();
function shouldSend(key: string, windowMs = 3000) {
  const now = Date.now();
  const last = sentCache.get(key) || 0;
  if (now - last < windowMs) return false;
  sentCache.set(key, now);
  return true;
}

async function postTrack(payload: {
  event: TrackEvent;
  productId?: string;
  page?: string;
  meta?: Record<string, any>;
}) {
  if (typeof window === "undefined") return;
  const sessionId = getSessionId();
  const key = `${payload.event}:${payload.productId || payload.page || ""}`;
  if (!shouldSend(key)) return;
  try {
    await api.post("/analytics/track", { sessionId, ...payload });
  } catch {
    // Silent fail; analytics shouldn't break UX
  }
}

export async function trackProductView(productId: string) {
  return postTrack({ event: "view", productId });
}
export async function trackAddToCart(productId: string) {
  return postTrack({ event: "cart", productId });
}
export async function trackCheckout() {
  return postTrack({ event: "checkout", page: "/checkout" });
}