import dynamic from "next/dynamic";
import Link from "next/link";
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
import OverviewCards from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import { fillSalesSeries } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartBarIcon,
  ShoppingCartIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

type Overview = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
};
type SalesPoint = { date: string; orders: number; revenue: number };
type SellerOrder = {
  _id?: string;
  status: string;
  items: { qty: number; price: number }[];
  user?: { _id: string; email?: string };
  createdAt?: string;
};
type TopProduct = { product: string; sold: number; revenue: number };

function useDebounced<T>(value: T, delay = 350) {
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

const isCanceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.message === "canceled";

function UpdatingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-55 bg-background/5 backdrop-blur-[1px]">
      <div className="rounded-full border-2 border-primary/20 border-t-primary h-6 w-6 animate-spin" />
    </div>
  );
}

function SellerHomePage() {
  const { user } = useAuth();
  const canAnalytics = hasSellerPerm(user as any, "seller:analytics:read");
  const canWriteProducts = hasSellerPerm(user as any, "seller:products:write");

  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"7d" | "14d" | "30d">("7d");
  useEffect(() => {
    setDays(tab === "7d" ? 7 : tab === "14d" ? 14 : 30);
  }, [tab]);

  const debouncedDays = useDebounced(days, 350);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const initialRef = useRef(true);

  const fetchAll = async (d: number) => {
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
      const calls: Promise<any>[] = [];

      if (canAnalytics) {
        calls.push(api.get("/seller/analytics/overview", { signal: c.signal }));
        calls.push(
          api.get("/seller/analytics/sales", {
            params: { days: d },
            signal: c.signal,
          })
        );
      } else {
        calls.push(Promise.resolve({ data: null }));
        calls.push(Promise.resolve({ data: [] }));
      }

      calls.push(
        api.get("/seller/orders", { params: { days: d }, signal: c.signal })
      );
      calls.push(
        api.get("/seller/analytics/top-products", {
          params: { days: d },
          signal: c.signal,
        })
      );

      const [ovRes, salRes, ordRes, topRes] = await Promise.all(calls);

      if (controllerRef.current !== current) return;

      setOverview(ovRes.data || null);
      setSalesRaw(salRes.data || []);
      setOrders(ordRes.data || []);
      setTop(topRes.data || []);
    } catch (e: any) {
      if (!isCanceled(e)) {
        // optional: show toast
      }
    } finally {
      if (controllerRef.current === current) {
        setLoading(false);
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    fetchAll(debouncedDays);
  }, [debouncedDays, canAnalytics]);

  const sales = useMemo(
    () => fillSalesSeries(days, salesRaw),
    [salesRaw, days]
  );
  const trends = useMemo(
    () => ({
      orders: sales.map((d) => d.orders),
      revenue: sales.map((d) => d.revenue),
    }),
    [sales]
  );

  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  const exportSalesCSV = () =>
    downloadCSV(
      "seller-dashboard-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      { date: "Date", orders: "Orders", revenue: "Revenue" }
    );

  const exportOrdersCSV = () =>
    downloadCSV(
      "seller-dashboard-orders.csv",
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
      "seller-dashboard-top-products.csv",
      (top || []).map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );

  const shortcuts = [
    {
      href: "/seller/analytics",
      label: "Analytics Dashboard",
      icon: ChartBarIcon,
      perm: "seller:analytics:read",
    },
    {
      href: "/seller/orders",
      label: "Manage Orders",
      icon: ShoppingCartIcon,
      perm: "seller:orders:read",
    },
    {
      href: "/seller/products",
      label: "My Products",
      icon: CubeIcon,
      perm: "seller:products:read",
    },
  ].filter((s) => hasSellerPerm(user as any, s.perm));

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5 mb-8">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
              Seller Hub
            </h1>
            {!canAnalytics ? (
              <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                Analytics restricted for your account. You can still access management options.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Overview of your store performance, recent activities, and metrics.
              </p>
            )}
          </div>
        </div>

        {/* KPIs / Loading */}
        {loading ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
            <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading store metrics...</p>
          </div>
        ) : canAnalytics ? (
          <OverviewCards
            stats={{
              totalUsers: 0,
              totalOrders: overview?.totalOrders || 0,
              totalProducts: overview?.totalProducts || 0,
              totalRevenue: overview?.totalRevenue || 0,
            }}
            trends={trends}
          />
        ) : null}

        {/* Filters */}
        <div className="mt-8 flex items-center justify-between gap-4 flex-wrap bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Store Performance</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary/35 border border-border/40 rounded-full p-1">
              {(["7d", "14d", "30d"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    tab === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Charts + Lists */}
        <div className="relative">
          <UpdatingOverlay show={fetching} />

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Charts Column */}
            <div className="xl:col-span-7 space-y-6">
              <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Revenue & Orders ({days} days)</h3>
                  <button onClick={exportSalesCSV} className="btn py-1.5 px-3 text-[10px]">
                    Export CSV
                  </button>
                </div>
                <div className="p-5">
                  <div className="w-full h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={sales}
                        margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: "500" }}
                          axisLine={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                          tickLine={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
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

              <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Average Order Value (AOV)</h3>
                  <button
                    onClick={() =>
                      downloadCSV(
                        "seller-dashboard-aov.csv",
                        aovData.map((d) => ({
                          date: csvDate(d.date),
                          aov: d.aov,
                        })),
                        { date: "Date", aov: "AOV" }
                      )
                    }
                    className="btn py-1.5 px-3 text-[10px]"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="p-5">
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={aovData}
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

            {/* Top Products + Quick actions */}
            <div className="xl:col-span-5 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
              <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Top Performing Products</h3>
                <button onClick={exportTopProductsCSV} className="btn py-1.5 px-3 text-[10px]">
                  Export CSV
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                {top.length === 0 ? (
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">No sales recorded in this interval</div>
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
                        {top.slice(0, 8).map((t, idx) => (
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

                {/* Shortcuts */}
                <div className="mt-6 grid grid-cols-1 gap-2.5">
                  {shortcuts.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center gap-3 p-4 border border-border/40 rounded-xl bg-secondary/15 hover:bg-secondary/25 transition-all duration-200"
                    >
                      <s.icon className="w-5 h-5 text-primary" strokeWidth={2} />
                      <span className="text-foreground font-bold uppercase tracking-wider text-xs">{s.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="mt-8 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Recent Store Orders
              </h3>
              <button onClick={exportOrdersCSV} className="btn py-1.5 px-3 text-[10px]">
                Export CSV
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">No orders received in this interval</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-secondary/25 border-b border-border/35">
                    <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-6 py-4 border-r border-border/20">Order</th>
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
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerHomePage), { ssr: false });
