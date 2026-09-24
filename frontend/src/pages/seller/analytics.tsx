import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import SellerLayout from "../../components/layout/SellerLayout";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import PermissionGate from "../../components/layout/PermissionGate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import StarsBar from "../../components/charts/StarsBar";
import OverviewCards from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { currency } from "../../utils/format";
import { downloadCSV, csvDate } from "../../utils/csv";
import { fillSalesSeries, fillSalesSeriesRange } from "../../utils/analytics";
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
  Cell,
} from "recharts";

type Overview = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
};
type SalesPoint = { date: string; orders: number; revenue: number };
type SellerOrder = {
  _id?: string;
  status: string;
  items: {
    qty: number;
    price: number;
    product?: { title?: string; category?: string };
  }[];
  user?: { _id: string; email?: string };
  createdAt?: string;
};
type TopProduct = {
  productId: string;
  product: string;
  sold: number;
  revenue: number;
};
type ReviewsAnalytics = {
  totalReviews: number;
  overallAvgRating: number;
  distribution: Record<string, number>;
  topReviewed: {
    productId: string;
    product: string;
    avgRating: number;
    reviews: number;
  }[];
};

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
function lastNDaysRange(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: fmt(from), to: fmt(to) };
}
const isCanceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.message === "canceled";

const categoryColor = (name: string) => {
  const s = String(name || "Other");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 50%)`;
};

function UpdatingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-55 bg-background/5 backdrop-blur-[1px]">
      <div className="rounded-full border-2 border-primary/20 border-t-primary h-6 w-6 animate-spin" />
    </div>
  );
}

function SellerAnalyticsPage() {
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
  const debounced = useDebounced(params, 400);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [reviews, setReviews] = useState<ReviewsAnalytics | null>(null);
  const [catDict, setCatDict] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const initialRef = useRef(true);

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
    controllerRef.current?.abort();
    const c = new AbortController();
    controllerRef.current = c;
    const current = c;

    if (initialRef.current) {
      setLoading(true);
      initialRef.current = false;
    } else {
      setFetching(true);
    }

    try {
      const [
        { data: ov },
        { data: sal },
        { data: ord },
        { data: top },
        { data: rev },
      ] = await Promise.all([
        api.get("/seller/analytics/overview", { params: p, signal: c.signal }),
        api.get("/seller/analytics/sales", { params: p, signal: c.signal }),
        api.get("/seller/orders", { params: p, signal: c.signal }),
        api.get("/seller/analytics/top-products", {
          params: p,
          signal: c.signal,
        }),
        api.get("/seller/analytics/reviews", { params: p, signal: c.signal }),
      ]);

      if (controllerRef.current !== current) return;
      setOverview(ov || null);
      setSalesRaw(sal || []);
      setOrders(ord || []);
      setTopProducts(top || []);
      setReviews(rev || null);
    } catch (e: any) {
      if (!isCanceled(e)) {
        // Optional toast
      }
    } finally {
      if (controllerRef.current === current) {
        setLoading(false);
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    if ("from" in debounced && "to" in debounced) {
      if (!debounced.from || !debounced.to) return;
    }
    fetchAll(debounced);
  }, [JSON.stringify(debounced)]);

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
  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

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

  const exportSalesCSV = () =>
    downloadCSV(
      "seller-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      { date: "Date", orders: "Orders", revenue: "Revenue" }
    );
  const exportOrdersCSV = () =>
    downloadCSV(
      "seller-orders.csv",
      orders.map((o: any) => ({
        id: o._id,
        date: csvDate(o.createdAt || ""),
        status: o.status,
        total: (o.items || []).reduce(
          (s: number, it: any) => s + it.qty * it.price,
          0
        ),
        customer: o.user?.email || "",
      })),
      {
        id: "Order ID",
        date: "Date",
        status: "Status",
        total: "Total",
        customer: "Customer",
      }
    );
  const exportTopProductsCSV = () =>
    downloadCSV(
      "seller-top-products.csv",
      (topProducts || []).map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );
  const exportCategoriesCSV = () =>
    downloadCSV("seller-categories.csv", categoryBars, {
      name: "Category",
      qty: "Units",
    });
  const exportAOVCSV = () =>
    downloadCSV(
      "seller-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      { date: "Date", aov: "AOV" }
    );

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:analytics:read"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to view store analytics.</p>
            </div>
          }
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5 mb-8">
            <div>
              <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
                Store Analytics
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Analyze store revenue, customer reviews, category breakdowns, and products.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading store metrics...</p>
            </div>
          ) : (
            <>
              <OverviewCards
                stats={{
                  totalUsers: 0,
                  totalOrders: overview?.totalOrders || 0,
                  totalProducts: overview?.totalProducts || 0,
                  totalRevenue: overview?.totalRevenue || 0,
                }}
                trends={{ orders: ordersSeries, revenue: revenueSeries }}
              />

              {/* Time Range Filter Bar */}
              <div className="mt-8 flex items-center justify-between gap-4 flex-wrap bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Time Period</h2>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex bg-secondary/35 border border-border/40 rounded-full p-1">
                    {["7d", "14d", "30d", "90d", "custom"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                          tab === t
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t === "custom" ? "Custom Range" : t}
                      </button>
                    ))}
                  </div>

                  {tab === "custom" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={from}
                        onChange={(e) =>
                          setRange((r) => ({ ...r, from: e.target.value }))
                        }
                        className="bg-card/60 border border-border/80 rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">to</span>
                      <input
                        type="date"
                        value={to}
                        onChange={(e) =>
                          setRange((r) => ({ ...r, to: e.target.value }))
                        }
                        className="bg-card/60 border border-border/80 rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!loading && (
            <div className="relative">
              <UpdatingOverlay show={fetching} />

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                  {/* Revenue & Orders */}
                  <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                    <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Revenue & Orders {tab !== "custom" && `(last ${days} days)`}</h3>
                      <button onClick={exportSalesCSV} className="btn py-1.5 px-3 text-[10px]">
                        Export CSV
                      </button>
                    </div>
                    <div className="p-5">
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={sales}
                            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <YAxis
                              yAxisId="left"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid border-border/40",
                                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                                borderRadius: "8px",
                                fontWeight: "600",
                                fontFamily: "Outfit, sans-serif",
                                fontSize: "11px",
                              }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(v: any, n: any) =>
                                n === "revenue"
                                  ? `₹${Number(v).toLocaleString("en-IN")}`
                                  : v
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                            <Line
                              isAnimationActive
                              animationDuration={300}
                              yAxisId="left"
                              type="monotone"
                              dataKey="orders"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, fill: 'hsl(var(--card))', r: 3 }}
                              activeDot={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 5, fill: 'hsl(var(--primary))' }}
                              name="Orders"
                            />
                            <Line
                              isAnimationActive
                              animationDuration={300}
                              yAxisId="right"
                              type="monotone"
                              dataKey="revenue"
                              stroke="#c5a059"
                              strokeWidth={2}
                              dot={{ stroke: '#c5a059', strokeWidth: 1, fill: 'hsl(var(--card))', r: 3 }}
                              activeDot={{ stroke: '#c5a059', strokeWidth: 2, r: 5, fill: '#c5a059' }}
                              name="Revenue"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* AOV */}
                  <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                    <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Average Order Value (AOV)</h3>
                      <button onClick={exportAOVCSV} className="btn py-1.5 px-3 text-[10px]">
                        Export CSV
                      </button>
                    </div>
                    <div className="p-5">
                      <div className="w-full h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={sales.map((d) => ({
                              date: d.date,
                              aov: d.orders
                                ? Math.round(d.revenue / d.orders)
                                : 0,
                            }))}
                            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="3 3"/>
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid border-border/40",
                                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                                borderRadius: "8px",
                                fontWeight: "600",
                                fontFamily: "Outfit, sans-serif",
                                fontSize: "11px",
                              }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(v: any) =>
                                `₹${Number(v).toLocaleString("en-IN")}`
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                            <Line
                              isAnimationActive
                              animationDuration={300}
                              type="monotone"
                              dataKey="aov"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, fill: 'hsl(var(--card))', r: 3 }}
                              activeDot={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 5, fill: 'hsl(var(--primary))' }}
                              name="AOV"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders by Category + Ratings */}
                <div className="xl:col-span-5 space-y-6">
                  <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                    <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Orders by Category</h3>
                      <button onClick={exportCategoriesCSV} className="btn py-1.5 px-3 text-[10px]">
                        Export CSV
                      </button>
                    </div>
                    <div className="p-5">
                      <div className="w-full h-[260px]">
                        {categoryBars.length === 0 ? (
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">
                            No category data recorded in this interval
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={categoryBars}
                              layout="vertical"
                              margin={{ left: 12, right: 12 }}
                            >
                              <XAxis type="number" hide />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                                width={120}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid border-border/40",
                                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                                  borderRadius: "8px",
                                  fontWeight: "600",
                                  fontFamily: "Outfit, sans-serif",
                                  fontSize: "11px",
                                }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                                formatter={(value: any) => [`${value}`, "Units"]}
                                labelFormatter={(label: any) => `Category: ${label}`}
                                cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                              />
                              <Bar
                                dataKey="qty"
                                isAnimationActive
                                animationDuration={300}
                              >
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
                        <div className="mt-6 flex flex-wrap gap-2">
                          {categoryBars.map((c) => (
                            <span
                              key={c.name}
                              className="border border-border/40 rounded-full px-2.5 py-1 text-[9px] font-semibold tracking-wider text-muted-foreground bg-secondary/15 flex items-center gap-1.5"
                            >
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ background: categoryColor(c.name) }}
                              />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                    <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Ratings Overview</h3>
                      <button
                        onClick={() =>
                          downloadCSV(
                            "seller-reviews.csv",
                            (reviews?.topReviewed || []).map((r) => ({
                              product: r.product,
                              avgRating: r.avgRating,
                              reviews: r.reviews,
                            })),
                            {
                              product: "Product",
                              avgRating: "Avg Rating",
                              reviews: "Reviews",
                            }
                          )
                        }
                        className="btn py-1.5 px-3 text-[10px]"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="p-5">
                      <StarsBar
                        distribution={reviews?.distribution || {}}
                        avg={reviews?.overallAvgRating || 0}
                      />
                      <div className="mt-6 font-semibold uppercase tracking-wider text-xs text-muted-foreground p-3.5 border border-border/30 bg-secondary/10 rounded-lg text-center">
                        Total Reviews:{" "}
                        <span className="text-primary font-bold text-lg ml-1">
                          {reviews?.totalReviews || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders + Top Products */}
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                  <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Recent Orders</h3>
                    <button onClick={exportOrdersCSV} className="btn py-1.5 px-3 text-[10px]">
                      Export CSV
                    </button>
                  </div>
                  <div className="p-0">
                    {orders.length === 0 ? (
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">
                        No recent orders found
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-secondary/25 border-b border-border/35">
                            <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                              <th className="px-6 py-4 border-r border-border/20">Order ID</th>
                              <th className="px-6 py-4 border-r border-border/20">Date</th>
                              <th className="px-6 py-4 border-r border-border/20">Status</th>
                              <th className="px-6 py-4 border-r border-border/20">Total</th>
                              <th className="px-6 py-4">Customer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {orders.slice(0, 10).map((o) => {
                              const total = (o.items || []).reduce(
                                (s, it) => s + it.qty * it.price,
                                0
                              );
                              return (
                                <tr
                                  key={o._id}
                                  className="hover:bg-secondary/10 transition-colors"
                                >
                                  <td className="px-6 py-4 border-r border-border/20 font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                                    #{(o._id || "").slice(-6).toUpperCase()}
                                  </td>
                                  <td className="px-6 py-4 border-r border-border/20 font-semibold text-muted-foreground">
                                    {o.createdAt ? csvDate(o.createdAt) : "—"}
                                  </td>
                                  <td className="px-6 py-4 border-r border-border/20">
                                     <span className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px]
                                      ${
                                        o.status === "delivered"
                                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                          : o.status === "cancelled"
                                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                          : o.status === "processing"
                                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                      }
                                    `}>
                                      {o.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 border-r border-border/20 font-semibold text-foreground">{currency(total)}</td>
                                  <td className="px-6 py-4 font-semibold text-muted-foreground truncate max-w-[200px]">{o.user?.email || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                  <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Top Performing Products</h3>
                    <button
                      onClick={exportTopProductsCSV}
                      className="btn py-1.5 px-3 text-[10px]"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="p-5">
                    {topProducts.length === 0 ? (
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">No products sold in this interval</div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/30">
                        <table className="min-w-full text-xs">
                          <thead className="bg-secondary/25 border-b border-border/30">
                            <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                              <th className="px-4 py-3 border-r border-border/20">Product</th>
                              <th className="px-4 py-3 border-r border-border/20">Sold</th>
                              <th className="px-4 py-3">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {topProducts.map((t, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-secondary/10 transition-colors"
                              >
                                <td className="px-4 py-3 border-r border-border/20 font-semibold text-foreground truncate max-w-[200px]" title={t.product}>{t.product}</td>
                                <td className="px-4 py-3 border-r border-border/20 font-bold text-foreground">{t.sold}</td>
                                <td className="px-4 py-3 font-semibold text-primary">
                                  ₹{t.revenue.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerAnalyticsPage), {
  ssr: false,
});
