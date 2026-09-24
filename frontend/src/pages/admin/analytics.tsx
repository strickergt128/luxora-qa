import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import OverviewCards, {
  OverviewStats,
} from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import { fillSalesSeries, fillSalesSeriesRange } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type SalesPoint = { date: string; orders: number; revenue: number };
type TopProduct = {
  product: string;
  sold: number;
  revenue: number;
  ownerName?: string;
  ownerEmail?: string;
};
type AdminOrder = {
  _id: string;
  user?: { _id: string; email?: string; name?: string };
  items: {
    qty: number;
    price: number;
    product?: { title?: string; category?: string };
  }[];
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  payment?: { method?: string };
  createdAt: string;
};
type FunnelDay = {
  date: string;
  view: number;
  cart: number;
  checkout: number;
  purchase: number;
};

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function lastNDaysRange(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: fmtDate(from), to: fmtDate(to) };
}

const isCanceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.message === "canceled";

// Deterministic champagne-tuned colors for categories
const categoryColor = (name: string) => {
  const s = String(name || "Other");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 45%, 60%)`;
};

function AdminAnalyticsPage() {
  const { user } = useAuth();
  const canAnalytics = hasPerm(user as any, "analytics:read");

  // Range controls
  const [tab, setTab] = useState("30d");
  const [days, setDays] = useState(30);
  const [{ from, to }, setRange] = useState(lastNDaysRange(30));
  useEffect(() => {
    if (tab === "7d") setDays(7);
    else if (tab === "14d") setDays(14);
    else if (tab === "30d") setDays(30);
    else if (tab === "90d") setDays(90);
  }, [tab]);

  const params = useMemo(
    () => (tab === "custom" && from && to ? { from, to } : { days }),
    [tab, from, to, days]
  );
  const debounced = useDebounced(params, 350);

  // Data
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [funnelDaily, setFunnelDaily] = useState<FunnelDay[]>([]);
  const [funnelTotals, setFunnelTotals] = useState<{
    view: number;
    cart: number;
    checkout: number;
    purchase: number;
  }>({
    view: 0,
    cart: 0,
    checkout: 0,
    purchase: 0,
  });

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const cRef = useRef<AbortController | null>(null);

  // Category dictionary
  const [catDict, setCatDict] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/categories");
        if (!mounted) return;
        const map: Record<string, string> = {};
        (data || []).forEach((c: any) => {
          if (c?._id) map[String(c._id)] = c?.name || "";
          if (c?.slug) map[String(c.slug)] = c?.name || "";
        });
        setCatDict(map);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchAll = async (p: any) => {
    cRef.current?.abort();
    const c = new AbortController();
    cRef.current = c;
    setFetching(true);
    try {
      const [
        { data: s },
        { data: sal },
        { data: tp },
        { data: ord },
        { data: funnel },
      ] = await Promise.all([
        api.get("/admin/analytics/overview", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/sales", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/top-products", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/orders", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/funnel", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
      ]);
      setStats(s);
      setSalesRaw(sal || []);
      setTop(tp || []);
      setOrders(ord || []);
      setFunnelDaily(funnel?.daily || []);
      setFunnelTotals(
        funnel?.totals || { view: 0, cart: 0, checkout: 0, purchase: 0 }
      );
    } catch (e: any) {
      if (!isCanceled(e)) console.error(e);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!canAnalytics) return;
    if ("from" in debounced && "to" in debounced) {
      if (!debounced.from || !debounced.to) return;
    }
    fetchAll(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debounced), canAnalytics]);

  const sales = useMemo(() => {
    if (
      "from" in debounced &&
      "to" in debounced &&
      debounced.from &&
      debounced.to
    ) {
      return fillSalesSeriesRange(debounced.from, debounced.to, salesRaw);
    }
    return fillSalesSeries((debounced as any).days || days, salesRaw);
  }, [debounced, salesRaw, days]);

  const ordersSeries = sales.map((d) => d.orders);
  const revenueSeries = sales.map((d) => d.revenue);
  const totalRevenue = revenueSeries.reduce((s, n) => s + n, 0);
  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  const statusCounts = useMemo(() => {
    const mapObj: Record<string, number> = {};
    for (const o of orders) mapObj[o.status] = (mapObj[o.status] || 0) + 1;
    return mapObj;
  }, [orders]);

  const resolveCategoryName = (raw: any): string => {
    if (!raw) return "Other";
    const str = String(raw);
    if (catDict[str]) return catDict[str];
    const pretty = str.replace(/[-_]+/g, " ").trim();
    return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Other";
  };

  const categoryBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      for (const it of o.items || []) {
        const name = resolveCategoryName(it.product?.category);
        map.set(name, (map.get(name) || 0) + (it.qty || 0));
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12);
  }, [orders, catDict]);

  const paymentSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const pm = o.paymentMethod || o.payment?.method || "Card";
      map.set(pm, (map.get(pm) || 0) + 1);
    }
    const palette = [
      "#c5a059",
      "#0ea5e9",
      "#10b981",
      "#f59e0b",
      "#a855f7",
      "#f43f5e",
      "#22c55e",
      "#06b6d4",
    ];
    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: palette[i % palette.length],
    }));
  }, [orders]);

  const weekdayData = useMemo(() => {
    const mapObj: Record<string, { revenue: number; orders: number }> = {
      Sun: { revenue: 0, orders: 0 },
      Mon: { revenue: 0, orders: 0 },
      Tue: { revenue: 0, orders: 0 },
      Wed: { revenue: 0, orders: 0 },
      Thu: { revenue: 0, orders: 0 },
      Fri: { revenue: 0, orders: 0 },
      Sat: { revenue: 0, orders: 0 },
    };
    for (const o of orders) {
      const d = new Date(o.createdAt);
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      mapObj[day].orders += 1;
      mapObj[day].revenue += o.totalAmount || 0;
    }
    return Object.entries(mapObj).map(([name, v]) => ({ name, ...v }));
  }, [orders]);

  const statusPie = useMemo(() => {
    const colors: Record<string, string> = {
      delivered: "#10b981",
      shipped: "#3b82f6",
      confirmed: "#c5a059",
      pending: "#f59e0b",
      cancelled: "#f43f5e",
    };
    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: colors[name] || "#9ca3af",
    }));
  }, [statusCounts]);

  const exportSalesCSV = () =>
    downloadCSV(
      "admin-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      {
        date: "Date",
        orders: "Orders",
        revenue: "Revenue",
      }
    );
  const exportAOVCSV = () =>
    downloadCSV(
      "admin-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      {
        date: "Date",
        aov: "AOV",
      }
    );
  const exportCategoriesCSV = () =>
    downloadCSV(
      "admin-categories.csv",
      categoryBars.map((d) => ({ category: d.name, qty: d.qty })),
      {
        category: "Category",
        qty: "Units",
      }
    );
  const exportPaymentCSV = () =>
    downloadCSV(
      "admin-payments.csv",
      paymentSplit.map((d) => ({ method: d.name, count: d.value })),
      {
        method: "Payment Method",
        count: "Count",
      }
    );
  const exportStatusCSV = () => {
    const rows = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
    downloadCSV("admin-status.csv", rows, { status: "Status", count: "Count" });
  };
  const exportWeekdayCSV = () =>
    downloadCSV("admin-weekday.csv", weekdayData, {
      name: "Day",
      orders: "Orders",
      revenue: "Revenue",
    });

  const exportFunnelCSV = () =>
    downloadCSV(
      "admin-funnel.csv",
      funnelDaily.map((d) => ({
        date: csvDate(d.date),
        views: d.view,
        carts: d.cart,
        checkouts: d.checkout,
        purchases: d.purchase,
      })),
      {
        date: "Date",
        views: "Views",
        carts: "Add to cart",
        checkouts: "Checkout",
        purchases: "Purchases",
      }
    );

  const pct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <PermissionGate
          perm="analytics:read"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-8 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              You don&apos;t have access to global site analytics metrics.
            </div>
          }
        >
          {/* Top KPIs */}
          <div className="min-w-0">
            <OverviewCards
              stats={{
                totalUsers: stats?.totalUsers || 0,
                totalOrders: stats?.totalOrders || 0,
                totalProducts: stats?.totalProducts || 0,
                totalRevenue: totalRevenue || 0,
              }}
              trends={{ orders: ordersSeries, revenue: revenueSeries }}
            />
          </div>

          {/* Range controls */}
          <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
            <div>
              <h2 className="display-font text-2xl font-semibold tracking-wide text-foreground">Operational Performance</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Select visual parameters, date intervals, and compile CSV data reports.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
                <TabsList className="bg-card/50 border border-border/40 rounded-lg p-1 flex">
                  <TabsTrigger value="7d" className="rounded-md font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all duration-200">7d</TabsTrigger>
                  <TabsTrigger value="14d" className="rounded-md font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all duration-200">14d</TabsTrigger>
                  <TabsTrigger value="30d" className="rounded-md font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all duration-200">30d</TabsTrigger>
                  <TabsTrigger value="90d" className="rounded-md font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all duration-200">90d</TabsTrigger>
                  <TabsTrigger value="custom" className="rounded-md font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all duration-200">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={from}
                    aria-label="Custom range start date"
                    onChange={(e) =>
                      setRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className="w-full sm:w-auto bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">TO</span>
                  <input
                    type="date"
                    value={to}
                    aria-label="Custom range end date"
                    onChange={(e) =>
                      setRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className="w-full sm:w-auto bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Charts grid */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left: dual line + AOV */}
            <div className="xl:col-span-7 space-y-8 min-w-0">
              <Card className="min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
                <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                  <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Revenue & Order Volume</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportSalesCSV}
                    className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[320px] text-xs font-semibold">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={sales}
                        margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                          formatter={(v: any, n: any) =>
                            n === "revenue"
                              ? `₹${Number(v).toLocaleString("en-IN")}`
                              : v
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="orders"
                          stroke="#c5a059"
                          strokeWidth={2}
                          dot={false}
                          name="Orders"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="Revenue"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
                <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                  <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Average Order Value (AOV)</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportAOVCSV}
                    className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px] text-xs font-semibold">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={aovData}
                        margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                          formatter={(v: any) =>
                            `₹${Number(v).toLocaleString("en-IN")}`
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                        <Line
                          type="monotone"
                          dataKey="aov"
                          stroke="#c5a059"
                          strokeWidth={2}
                          dot={false}
                          name="AOV"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: two donuts */}
            <div className="xl:col-span-5 grid grid-cols-1 gap-8 min-w-0">
              <Card className="min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
                <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                  <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Payment Methods</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportPaymentCSV}
                    className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px] text-xs">
                    {paymentSplit.length === 0 ? (
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider italic text-center py-20">No data compiled.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentSplit}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                          >
                            {paymentSplit.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {paymentSplit.length > 0 && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {paymentSplit.map((p) => (
                        <span
                          key={p.name}
                          className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground border border-border/30 bg-card/40 px-2.5 py-1 rounded-md"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: p.color }}
                          />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
                <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                  <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Order Status</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportStatusCSV}
                    className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px] text-xs">
                    {statusPie.length === 0 ? (
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider italic text-center py-20">No data compiled.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            {statusPie.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {statusPie.length > 0 && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {statusPie.map((s) => (
                        <span
                          key={s.name}
                          className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground border border-border/30 bg-card/40 px-2.5 py-1 rounded-md"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="mt-8">
            <Card className="min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
              <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Conversion Funnel</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportFunnelCSV}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "view", label: "Views", color: "#9ca3af" },
                    { key: "cart", label: "Add to Cart", color: "#0ea5e9" },
                    { key: "checkout", label: "Checkout", color: "#c5a059" },
                    { key: "purchase", label: "Purchases", color: "#10b981" },
                  ].map((s, idx, arr) => {
                    const val = (funnelTotals as any)[s.key] || 0;
                    const prev =
                      idx === 0
                        ? val
                        : (funnelTotals as any)[arr[idx - 1].key] || 0;
                    const p = pct(val, prev);
                    return (
                      <div
                        key={s.key}
                        className="border border-border/30 bg-card/40 p-4 rounded-xl shadow-sm transition-all duration-200"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
                        <div className="text-3xl font-bold text-foreground mt-1">
                          {val}
                        </div>
                        <div className="mt-3.5 h-3 bg-secondary/15 rounded-full overflow-hidden p-0.5 border border-border/20">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p}%`,
                              background: s.color,
                              transition: "width .3s ease",
                            }}
                          />
                        </div>
                        {idx > 0 && (
                          <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-right border-t border-border/20 pt-2">
                            {p}% conversion from {arr[idx - 1].label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="w-full h-[320px] mt-6 text-xs font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={funnelDaily}
                      margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                      <Line
                        type="monotone"
                        dataKey="view"
                        name="Views"
                        stroke="#9ca3af"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cart"
                        name="Add to Cart"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="checkout"
                        name="Checkout"
                        stroke="#c5a059"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchase"
                        name="Purchases"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category bars & Weekday performance */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            <Card className="xl:col-span-7 min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
              <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Orders by Category</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportCategoriesCSV}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[300px] text-xs font-semibold">
                  {categoryBars.length === 0 ? (
                    <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider italic text-center py-24">
                      No category data.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryBars}
                        layout="vertical"
                        margin={{ left: 12, right: 24 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                          formatter={(value: any) => [`${value}`, "Units"]}
                          labelFormatter={(label: any) => `Category: ${label}`}
                          cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                        />
                        <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                          {categoryBars.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={categoryColor(entry.name)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {categoryBars.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {categoryBars.map((c) => (
                      <span
                        key={c.name}
                        className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground border border-border/30 bg-card/40 px-2.5 py-1 rounded-md"
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: categoryColor(c.name) }}
                        />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft">
              <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-4">
                <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Weekday Performance</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportWeekdayCSV}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[300px] text-xs font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                        formatter={(v: any, n: any) =>
                          n === "revenue"
                            ? `₹${Number(v).toLocaleString("en-IN")}`
                            : v
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                      <Bar
                        yAxisId="left"
                        dataKey="orders"
                        name="Orders"
                        fill="#c5a059"
                        barSize={12}
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="revenue"
                        name="Revenue"
                        fill="#10b981"
                        barSize={12}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            <Card className="xl:col-span-7 min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
              <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-0">
                <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Recent Orders</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      "admin-orders.csv",
                      orders.map((o: any) => ({
                        id: o._id,
                        date: csvDate(o.createdAt),
                        status: o.status,
                        total: o.totalAmount,
                        customer: o.user?.email || "",
                      })),
                      {
                        id: "Order ID",
                        date: "Date",
                        status: "Status",
                        total: "Total",
                        customer: "Customer",
                      }
                    )
                  }
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0 p-0 flex-1 overflow-auto">
                {orders.length === 0 ? (
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider italic p-6 text-center">No orders found.</div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/25 border-b border-border/35">
                        <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                          <th className="px-6 py-4 border-r border-border/20 whitespace-nowrap">Customer</th>
                          <th className="px-6 py-4 border-r border-border/20 whitespace-nowrap">Date</th>
                          <th className="px-6 py-4 border-r border-border/20 text-center whitespace-nowrap">Status</th>
                          <th className="px-6 py-4 text-right whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-medium text-foreground">
                        {orders.slice(0, 10).map((o) => (
                          <tr
                            key={o._id}
                            className="hover:bg-secondary/5 transition-colors"
                          >
                            <td className="px-6 py-4 border-r border-border/20 max-w-[150px] truncate" title={o.user?.name || o.user?.email || "—"}>
                              {o.user?.name || o.user?.email || "—"}
                            </td>
                            <td className="px-6 py-4 border-r border-border/20 whitespace-nowrap">{csvDate(o.createdAt)}</td>
                            <td className="px-6 py-4 border-r border-border/20 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider
                                ${
                                  o.status === "delivered" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                  o.status === "shipped" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                  o.status === "confirmed" ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" :
                                  o.status === "cancelled" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                  "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                }
                              `}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap text-primary font-bold">{currency(o.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
              <CardHeader className="flex-row items-center justify-between border-b border-border/25 pb-4 mb-0">
                <CardTitle className="display-font text-lg font-semibold tracking-wide text-foreground">Top Products</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      "admin-top-products.csv",
                      top.map((t: any) => ({
                        product: t.product,
                        sold: t.sold,
                        revenue: t.revenue,
                        ownerName: t.ownerName || "",
                        ownerEmail: t.ownerEmail || "",
                      })),
                      {
                        product: "Product",
                        sold: "Sold",
                        revenue: "Revenue",
                        ownerName: "Owner Name",
                        ownerEmail: "Owner Email",
                      }
                    )
                  }
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0 p-0 flex-1 overflow-auto">
                {top.length === 0 ? (
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider italic p-6 text-center">No top products compiled.</div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/25 border-b border-border/35">
                        <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                          <th className="px-6 py-4 border-r border-border/20 whitespace-nowrap">Product</th>
                          <th className="px-6 py-4 border-r border-border/20 text-center whitespace-nowrap">Sold</th>
                          <th className="px-6 py-4 border-r border-border/20 text-right whitespace-nowrap">Revenue</th>
                          <th className="px-6 py-4 whitespace-nowrap">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-medium text-foreground">
                        {top.map((t, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-secondary/5 transition-colors"
                          >
                            <td className="px-6 py-4 border-r border-border/20 max-w-[150px] truncate" title={t.product}>{t.product}</td>
                            <td className="px-6 py-4 border-r border-border/20 text-center">
                              <span className="bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]">{t.sold}</span>
                            </td>
                            <td className="px-6 py-4 border-r border-border/20 text-right text-emerald-500 font-bold whitespace-nowrap">
                              {currency(t.revenue)}
                            </td>
                            <td className="px-6 py-4 max-w-[120px] truncate text-muted-foreground" title={t.ownerName || "—"}>{t.ownerName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </PermissionGate>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminAnalyticsPage), {
  ssr: false,
});
