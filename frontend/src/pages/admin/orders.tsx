import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency, shortDate } from "../../utils/format";

type OrderItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};

type AdminOrder = {
  _id: string;
  user?: { _id: string; name: string; email: string };
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
};

const STATUSES: AdminOrder["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

function StatusBadge({ text, status }: { text: string; status: AdminOrder["status"] }) {
  const badgeStyle = () => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "confirmed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "shipped":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "delivered":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "cancelled":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border/40";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider ${badgeStyle()}`}
    >
      {text}
    </span>
  );
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdminOrder["status"]>("all");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal state for confirming status change with note
  const [modalOpen, setModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState<AdminOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<AdminOrder["status"]>("pending");
  const [note, setNote] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/orders");
      setOrders(data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesQ =
        !q ||
        o._id.toLowerCase().includes(q.toLowerCase()) ||
        o.user?.email?.toLowerCase().includes(q.toLowerCase()) ||
        o.user?.name?.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = status === "all" || o.status === status;
      return matchesQ && matchesStatus;
    });
  }, [orders, q, status]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requestStatusChange = (
    order: AdminOrder,
    newStatus: AdminOrder["status"]
  ) => {
    if (order.status === newStatus) return;
    setTargetOrder(order);
    setNextStatus(newStatus);
    setNote("");
    setModalOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!targetOrder) return;
    setUpdatingId(targetOrder._id);
    try {
      await api.patch(`/admin/orders/${targetOrder._id}/status`, {
        status: nextStatus,
        note: note?.trim() || undefined,
      });
      toast.success(`Status updated to ${nextStatus}`);
      setModalOpen(false);
      setTargetOrder(null);
      setNote("");
      await fetchOrders();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-5 mb-8">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Global Orders</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Monitor customer purchases, dispatch statuses, transaction values, and audit trails.
            </p>
          </div>
          <Link
            href="/admin/logs"
            className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex"
          >
            Audit Logs
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by order ID, email, or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              aria-label="Filter status"
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile list */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft text-center">
              <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft text-center text-xs text-muted-foreground italic">
              No orders found.
            </div>
          ) : (
            filtered.map((o) => (
              <div key={o._id} className="bg-card/60 backdrop-blur-md border border-border/40 p-4 rounded-xl shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-foreground">
                    #{o._id.slice(-6).toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {shortDate(o.createdAt)}
                  </div>
                </div>

                <div className="text-xs text-foreground font-medium">
                  {o.user?.name || "—"}{" "}
                  <span className="text-muted-foreground">
                    · {o.user?.email || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-primary font-semibold text-base">
                    {currency(o.totalAmount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge text={o.status} status={o.status} />
                    <select
                      disabled={updatingId === o._id}
                      aria-label="Order status update"
                      value={o.status}
                      onChange={(e) =>
                        requestStatusChange(
                          o,
                          e.target.value as AdminOrder["status"]
                        )
                      }
                      className="bg-card/60 border border-border/80 rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                  <button
                    onClick={() => toggleExpand(o._id)}
                    className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline transition-all"
                  >
                    {expanded.has(o._id) ? "Hide details" : "Show details"}
                  </button>
                  <Link
                    href={`/admin/logs?orderId=${o._id}`}
                    className="btn px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider"
                  >
                    Logs
                  </Link>
                </div>

                {expanded.has(o._id) && (
                  <div className="border-t border-border/20 pt-3 mt-3 space-y-2">
                    {o.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="text-foreground font-semibold truncate pr-4">
                          {(typeof it.product === "string"
                            ? it.product
                            : it.product?.title) || "Product"}{" "}
                          <span className="text-muted-foreground ml-1">× {it.qty}</span>
                        </div>
                        <div className="text-primary font-semibold whitespace-nowrap">
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Order ID</th>
                  <th className="px-6 py-4 border-r border-border/20">Customer</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Date</th>
                  <th className="px-6 py-4 border-r border-border/20 text-right">Total</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
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
                        <td className="px-6 py-4 border-r border-border/20 font-bold text-foreground">
                          #{o._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 max-w-[200px] truncate" title={o.user?.email || "—"}>
                          <div className="font-semibold text-foreground">{o.user?.name || "—"}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {o.user?.email || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center text-muted-foreground font-semibold whitespace-nowrap">
                          {shortDate(o.createdAt)}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-right text-foreground font-semibold whitespace-nowrap">
                          {currency(o.totalAmount)}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="flex items-center gap-2 justify-center">
                            <StatusBadge text={o.status} status={o.status} />
                            <select
                              disabled={updatingId === o._id}
                              aria-label="Select order status"
                              value={o.status}
                              onChange={(e) =>
                                requestStatusChange(
                                  o,
                                  e.target.value as AdminOrder["status"]
                                )
                              }
                              className="bg-card/60 border border-border/80 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/admin/logs?orderId=${o._id}`}
                              className="btn px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Logs
                            </Link>
                            <button
                              onClick={() => toggleExpand(o._id)}
                              className="btn px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              {expanded.has(o._id) ? "Hide" : "Details"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded.has(o._id) && (
                        <tr className="bg-secondary/5 border-t border-border/20 border-dashed">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-2 max-w-3xl">
                              {o.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs font-semibold bg-card/40 border border-border/20 p-3 rounded-lg"
                                >
                                  <div className="text-foreground truncate pr-4">
                                    {(typeof it.product === "string"
                                      ? it.product
                                      : it.product?.title) || "Product"}{" "}
                                    <span className="text-muted-foreground ml-2">× {it.qty}</span>
                                  </div>
                                  <div className="text-primary font-bold whitespace-nowrap">
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
        </div>

        {/* Modal: confirm status change with optional note */}
        {modalOpen && targetOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl bg-card border border-border/40 shadow-soft overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/35 bg-secondary/15">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                  Update Order Status
                </h3>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-6 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Order ID</div>
                    <div className="text-foreground font-semibold">
                      #{targetOrder._id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Customer</div>
                    <div className="text-foreground font-semibold truncate">
                      {targetOrder.user?.name || "—"}
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        {targetOrder.user?.email || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 bg-secondary/10 p-4 border border-border/30 rounded-lg flex flex-col items-center justify-center gap-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Transition State</div>
                    <div className="flex items-center gap-4">
                      <StatusBadge
                        text={targetOrder.status}
                        status={targetOrder.status}
                      />
                      <span className="text-muted-foreground font-bold">→</span>
                      <StatusBadge text={nextStatus} status={nextStatus} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Optional Log Note / Reason
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Payment verified, handed to courier..."
                    className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/30 bg-secondary/20">
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={updatingId === targetOrder._id}
                  className="btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  {updatingId === targetOrder._id ? "Updating..." : "Confirm Update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminOrdersPage), { ssr: false });
