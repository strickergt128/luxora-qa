import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import SellerLayout from "../../components/layout/SellerLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { currency, shortDate } from "../../utils/format";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";

type SellerOrder = {
  _id: string;
  user?: { name?: string; email?: string };
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  items: {
    product: { _id: string; title: string };
    qty: number;
    price: number;
  }[];
  sellerTotal: number;
  totalAmount: number;
};

const STATUSES: SellerOrder["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

function SellerOrdersPage() {
  const { user } = useAuth();
  const canRead = hasSellerPerm(user as any, "seller:orders:read");
  const canWrite = hasSellerPerm(user as any, "seller:orders:write");
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SellerOrder["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchMine = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get("/seller/orders");
      setOrders(data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMine();
  }, [canRead]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const ql = q.trim().toLowerCase();
      const matchesQ =
        !ql ||
        o._id.toLowerCase().includes(ql) ||
        o.user?.email?.toLowerCase().includes(ql) ||
        o.user?.name?.toLowerCase().includes(ql);
      const matchesS = status === "all" || o.status === status;
      return matchesQ && matchesS;
    });
  }, [orders, q, status]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateStatus = async (id: string, newStatus: SellerOrder["status"]) => {
    if (!canWrite) {
      toast.error("You don't have permission to update order status");
      return;
    }
    setUpdating(id);
    try {
      await api.patch(`/seller/orders/${id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      await fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:orders:read"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to view store orders.</p>
            </div>
          }
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5 mb-8">
            <div>
              <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
                Store Orders
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Fulfill incoming orders, update shipping statuses, and view invoice summaries.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
            <input
              placeholder="Search by order ID, email, or name..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 w-full md:w-96"
            />
            <select
              value={status}
              aria-label="Filter by status"
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary w-full md:w-52"
            >
              <option value="all">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="bg-card/60 border border-border/40 p-8 text-center rounded-xl">
                <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card/60 border border-border/40 p-8 text-center rounded-xl text-xs font-semibold uppercase tracking-wider text-muted-foreground italic">No orders found.</div>
            ) : (
              filtered.map((o) => (
                <div key={o._id} className="bg-card/60 border border-border/40 p-5 rounded-xl shadow-soft flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/20 pb-2.5">
                    <div className="font-mono text-xs font-bold text-foreground">
                      #{o._id.slice(-6).toUpperCase()}
                    </div>
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {shortDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-xs text-foreground space-y-0.5">
                    <div className="font-semibold">{o.user?.name || "—"}</div>
                    <div className="text-muted-foreground">{o.user?.email || "—"}</div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/10">
                    <div className="text-primary font-semibold text-sm">
                      {currency(o.sellerTotal)}
                    </div>
                    <select
                      aria-label="Update order status"
                      disabled={updating === o._id}
                      value={o.status}
                      onChange={(e) =>
                        updateStatus(
                          o._id,
                          e.target.value as SellerOrder["status"]
                        )
                      }
                      className="bg-card/60 border border-border/85 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => toggleExpand(o._id)}
                    className="btn w-full py-2.5 text-[10px] mt-2 font-semibold uppercase tracking-wider"
                  >
                    {expanded.has(o._id) ? "Hide Details" : "Show Details"}
                  </button>
                  {expanded.has(o._id) && (
                    <div className="border-t border-border/20 pt-3 mt-1 space-y-2">
                      {o.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="font-semibold text-muted-foreground">
                            {it.product.title} × {it.qty}
                          </div>
                          <div className="font-bold text-foreground">
                            {currency(it.price * it.qty)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                  <th className="px-6 py-4 border-r border-border/20">Order ID</th>
                  <th className="px-6 py-4 border-r border-border/20">Customer</th>
                  <th className="px-6 py-4 border-r border-border/20">Date</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Seller Revenue</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center bg-secondary/5" colSpan={6}>
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5" colSpan={6}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <Fragment key={o._id}>
                      <tr className="hover:bg-secondary/5 transition-colors">
                        <td className="px-6 py-4 border-r border-border/20 font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                          #{o._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="font-semibold text-xs text-foreground truncate max-w-[200px]" title={o.user?.name}>{o.user?.name || "—"}</div>
                          <div className="text-[10px] text-muted-foreground tracking-wider truncate max-w-[200px]" title={o.user?.email}>
                            {o.user?.email || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 font-semibold text-muted-foreground">
                          {shortDate(o.createdAt)}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center">
                          <select
                            aria-label="Update order status"
                            disabled={updating === o._id}
                            value={o.status}
                            onChange={(e) =>
                              updateStatus(
                                o._id,
                                e.target.value as SellerOrder["status"]
                              )
                            }
                            className="bg-card/65 border border-border/80 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary text-center"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 font-semibold text-sm text-primary text-center">
                          {currency(o.sellerTotal)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(o._id)}
                            className="btn px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                          >
                            {expanded.has(o._id) ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expanded.has(o._id) && (
                        <tr className="bg-secondary/10 border-t border-border/20">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-2">
                              {o.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs font-semibold p-3.5 border border-border/30 rounded-lg bg-card/70 shadow-sm"
                                >
                                  <div className="text-foreground tracking-wider uppercase truncate max-w-[70%]">
                                    {it.product.title} <span className="text-muted-foreground lowercase font-normal ml-2">× {it.qty}</span>
                                  </div>
                                  <div className="text-foreground font-bold">
                                    {currency(it.price * it.qty)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerOrdersPage), { ssr: false });
