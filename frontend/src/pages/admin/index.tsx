import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import OverviewCards, {
  OverviewStats,
} from "../../components/charts/OverviewCards";
import { fillSalesSeries } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
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
  UsersIcon,
  ClipboardDocumentListIcon as ClipboardCheckIcon,
  CurrencyDollarIcon,
  TicketIcon,
  EnvelopeIcon,
  PhotoIcon,
  DocumentMagnifyingGlassIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

type TopProduct = { product: string; sold: number; revenue: number };
type SalesPoint = { date: string; orders: number; revenue: number };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const days = 7;

  const isAdmin = user?.role === "admin";
  const isSubadmin = user?.role === "subadmin";
  const userPerms = new Set<string>((user as any)?.permissions || []);
  const hasPerm = (perm: string) =>
    isAdmin || (isSubadmin && userPerms.has(perm));

  const analyticsRead = hasPerm("analytics:read");

  useEffect(() => {
    let mounted = true;

    if (!analyticsRead) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const [{ data: s }, { data: sal }, { data: tp }] = await Promise.all([
          api.get("/admin/analytics/overview"),
          api.get("/admin/analytics/sales", { params: { days } }),
          api.get("/admin/analytics/top-products"),
        ]);
        if (!mounted) return;
        setStats(s);
        setSalesRaw(sal || []);
        setTop(tp || []);
      } catch {
        if (!mounted) return;
        setStats(null);
        setSalesRaw([]);
        setTop([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [analyticsRead]);

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
      "dashboard-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      { date: "Date", orders: "Orders", revenue: "Revenue" }
    );

  const exportAOVCSV = () =>
    downloadCSV(
      "dashboard-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      { date: "Date", aov: "AOV" }
    );

  const exportTopProductsCSV = () =>
    downloadCSV(
      "dashboard-top-products.csv",
      top.map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );

  const shortcuts = [
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: ChartBarIcon,
      perm: "analytics:read",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: ShoppingCartIcon,
      perm: "orders:read",
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: CubeIcon,
      perm: "products:read",
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: TagIcon,
      perm: "products:read",
    },
    {
      href: "/admin/returns",
      label: "Returns",
      icon: CurrencyDollarIcon,
      perm: "returns:read",
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: UsersIcon,
      perm: "users:read",
    },
    {
      href: "/admin/seller-requests",
      label: "Seller Requests",
      icon: ClipboardCheckIcon,
      perm: "sellers:read",
    },
    {
      href: "/admin/coupons",
      label: "Coupons",
      icon: TicketIcon,
      perm: "coupons:read",
    },
    {
      href: "/admin/emails",
      label: "Email Templates",
      icon: EnvelopeIcon,
      perm: "emailTemplates:read",
    },
    {
      href: "/admin/media",
      label: "Media",
      icon: PhotoIcon,
      perm: "media:read",
    },
    {
      href: "/admin/logs",
      label: "Logs",
      icon: DocumentMagnifyingGlassIcon,
      perm: "logs:read",
    },
  ].filter((s) => !s.perm || hasPerm(s.perm));

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-6">
            <div>
              <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                Welcome{user?.name ? `, ${user.name}` : ""}.{" "}
                {isAdmin
                  ? "You have full administrative access."
                  : "You have sub-admin access based on assigned permissions."}
              </p>
            </div>
            {hasPerm("analytics:read") && (
              <Link href="/admin/analytics" className="inline-flex">
                <button className="btn-primary py-3 px-6 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4" />
                  Open Analytics
                </button>
              </Link>
            )}
          </div>

          {/* Analytics section (only if allowed) */}
          {analyticsRead ? (
            <>
              {loading ? (
                <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
                  <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading dashboard analytics...</p>
                </div>
              ) : (
                <>
                  {stats && <OverviewCards stats={stats} trends={trends} />}

                  {/* Charts grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
                    {/* Left column: 2 charts stacked */}
                    <div className="xl:col-span-7 space-y-6">
                      <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                        <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Last {days} Days — Revenue & Orders
                          </h3>
                          <button 
                            onClick={exportSalesCSV}
                            className="btn py-1.5 px-3 text-[10px]"
                          >
                            Export CSV
                          </button>
                        </div>
                        <div className="p-5">
                          <div className="w-full h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={sales}
                                margin={{
                                  top: 12,
                                  right: 16,
                                  left: 8,
                                  bottom: 8,
                                }}
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
                            onClick={exportAOVCSV}
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
                                margin={{
                                  top: 12,
                                  right: 16,
                                  left: 8,
                                  bottom: 8,
                                }}
                              >
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="3 3" />
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

                    {/* Right column: Top products */}
                    <div className="xl:col-span-5 bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft flex flex-col overflow-hidden">
                      <div className="flex flex-row items-center justify-between p-5 border-b border-border/35 bg-secondary/15">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Top Products</h3>
                        <button
                          onClick={exportTopProductsCSV}
                          className="btn py-1.5 px-3 text-[10px]"
                        >
                          Export CSV
                        </button>
                      </div>
                      <div className="p-5 flex-grow flex flex-col justify-between">
                        {top.length === 0 ? (
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-12 text-center italic">No catalog statistics recorded</div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border/30">
                            <table className="min-w-full text-xs">
                              <thead className="bg-secondary/25 border-b border-border/30">
                                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                                  <th className="px-4 py-3 border-r border-border/20">Product</th>
                                  <th className="px-4 py-3 border-r border-border/20 text-center">Sold</th>
                                  <th className="px-4 py-3 text-right">Revenue</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {top.slice(0, 8).map((t, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-secondary/10 transition-colors"
                                  >
                                    <td className="px-4 py-3 border-r border-border/20 font-semibold text-foreground truncate max-w-[150px]" title={t.product}>{t.product}</td>
                                    <td className="px-4 py-3 border-r border-border/20 text-center">
                                      <span className="font-bold text-foreground">{t.sold}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary font-semibold">
                                      {currency(t.revenue)}
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
                </>
              )}
            </>
          ) : (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
              <h3 className="text-lg font-semibold tracking-wide text-foreground">
                Analytics restricted
              </h3>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                You don't have access to Analytics. You can still use the tools
                below based on your permissions.
              </p>
            </div>
          )}

          {/* Shortcuts */}
          <section className="space-y-4 mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">Quick Shortcuts</h3>
            {shortcuts.length === 0 ? (
              <p className="text-foreground font-semibold text-xs">
                No admin areas available for your role. Please contact a full
                admin to assign permissions.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {shortcuts.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex flex-col items-center justify-center gap-3 p-6 border border-border/40 rounded-xl bg-card/40 hover:bg-card/85 transition-all duration-200 text-center shadow-soft"
                  >
                    <s.icon className="w-7 h-7 text-primary transition-transform duration-300" strokeWidth={1.5} />
                    <span className="text-foreground font-semibold uppercase tracking-wider text-[11px]">{s.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
