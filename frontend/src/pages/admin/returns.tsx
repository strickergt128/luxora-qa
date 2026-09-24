import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

type RRStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded"
  | "cancelled";

type RRItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};

type ReturnRequest = {
  _id: string;
  order: { _id: string; totalAmount?: number } | string;
  user: { _id: string; name?: string; email?: string } | string;
  items: RRItem[];
  reason?: string;
  note?: string;
  attachments?: { url: string; name?: string }[];
  status: RRStatus;
  refund?: {
    method?: "manual" | "bank" | "upi";
    reference?: string;
    amount?: number;
  };
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
};

type Paged<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

const statuses: RRStatus[] = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
  "cancelled",
];
const RETURN_WINDOW_DAYS = Number(
  process.env.NEXT_PUBLIC_RETURN_WINDOW_DAYS || 7
);

function StatusBadge({ status }: { status: RRStatus }) {
  const badgeStyle = () => {
    switch (status) {
      case "requested":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "approved":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "rejected":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "received":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "refunded":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "cancelled":
        return "bg-muted text-muted-foreground border-border/40";
      default:
        return "bg-muted text-muted-foreground border-border/40";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider ${badgeStyle()}`}
    >
      {status}
    </span>
  );
}

const shortId = (id: string) =>
  id?.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

function daysLeft(deliveredAtIso?: string) {
  if (!deliveredAtIso) return null;
  const deliveredAt = new Date(deliveredAtIso).getTime();
  const diffMs = Date.now() - deliveredAt;
  const used = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(RETURN_WINDOW_DAYS - used, 0);
}

const isImageUrl = (url?: string) =>
  !!url && /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(url);
const isVideoUrl = (url?: string) =>
  !!url && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

function AdminReturnsPage() {
  const [filters, setFilters] = useState({
    status: "",
    orderId: "",
    userId: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Paged<ReturnRequest>>({
    data: [],
    page: 1,
    limit,
    total: 0,
    hasNext: false,
  });

  const [deliveredAtCache, setDeliveredAtCache] = useState<
    Record<string, string | null>
  >({});

  // Action modal state
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ReturnRequest | null>(null);
  const [nextStatus, setNextStatus] = useState<RRStatus>("approved");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState<{
    method: "manual" | "bank" | "upi";
    reference?: string;
    amount?: number;
  }>({
    method: "manual",
  });
  const [submitting, setSubmitting] = useState(false);

  // Details modal state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<ReturnRequest | null>(
    null
  );

  const fetchList = async (pageArg = page) => {
    setLoading(true);
    try {
      const params: any = { page: pageArg, limit };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/returns", { params });
      setResp(data);
      setPage(data.page);
    } catch (err) {
      console.error(err);
      setResp({ data: [], page: 1, limit, total: 0, hasNext: false });
      toast.error("Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchDeliveredForOrders = async () => {
      const orderIds = Array.from(
        new Set(
          resp.data
            .map((rr) =>
              typeof rr.order === "string" ? rr.order : rr.order._id
            )
            .filter(Boolean) as string[]
        )
      );

      for (const oid of orderIds) {
        if (deliveredAtCache[oid] !== undefined) continue;
        try {
          const { data } = await api.get(`/admin/orders/${oid}/audit`);
          const delivered = (Array.isArray(data) ? data : []).find(
            (a: any) => a.toStatus === "delivered"
          );
          setDeliveredAtCache((c) => ({
            ...c,
            [oid]: delivered?.createdAt || null,
          }));
        } catch {
          setDeliveredAtCache((c) => ({ ...c, [oid]: null }));
        }
      }
    };
    if (resp.data.length > 0) fetchDeliveredForOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp.data]);

  const openAction = (rr: ReturnRequest, status: RRStatus) => {
    setTarget(rr);
    setNextStatus(status);
    setNote("");
    setRefund({ method: "manual" });
    setOpen(true);
  };

  const openDetails = (rr: ReturnRequest) => {
    setDetailsTarget(rr);
    setDetailsOpen(true);
  };

  const canTransition = (rr: ReturnRequest, status: RRStatus) => {
    const prev = rr.status;
    if (status === prev) return false;
    if (prev === "rejected" || prev === "cancelled") return false;
    if (status === "approved" && prev === "requested") return true;
    if (status === "rejected" && prev === "requested") return true;
    if (status === "received" && prev === "approved") return true;
    if (status === "refunded" && (prev === "approved" || prev === "received"))
      return true;
    if (status === "cancelled" && prev === "requested") return true;
    return false;
  };

  const submitAction = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const payload: any = {
        status: nextStatus,
        note: note?.trim() || undefined,
      };
      if (nextStatus === "refunded") {
        payload.refund = {
          method: refund.method || "manual",
          reference: refund.reference || "",
          amount: refund.amount != null ? Number(refund.amount) : undefined,
        };
      }
      await api.patch(`/admin/returns/${target._id}/status`, payload);
      toast.success(`Marked return request as ${nextStatus}`);
      setOpen(false);
      setTarget(null);
      await fetchList(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const prevPage = () => {
    if (loading || page <= 1) return;
    fetchList(page - 1);
  };
  const nextPage = () => {
    if (loading || !resp.hasNext) return;
    fetchList(page + 1);
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-5 mb-8">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Return & Refund Requests</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Audit customer claims, inspect attachments, configure refund amounts, and approve ticket lifecycles.
            </p>
          </div>
          <Link
            href="/admin/logs?tab=actions"
            className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            Audit Log Entries
          </Link>
        </div>

        {/* Filters */}
        <section className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft mb-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Order ID
              </label>
              <input
                value={filters.orderId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, orderId: e.target.value }))
                }
                placeholder="e.g., 65f..d2a"
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                User ID
              </label>
              <input
                value={filters.userId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, userId: e.target.value }))
                }
                placeholder="User ObjectId"
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">From Date</label>
              <input
                type="date"
                value={filters.from}
                aria-label="Filter start date selector"
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">To Date</label>
              <input
                type="date"
                value={filters.to}
                aria-label="Filter end date selector"
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 pt-2">
              <button
                onClick={() => fetchList(1)}
                className="btn-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({
                    status: "",
                    orderId: "",
                    userId: "",
                    from: "",
                    to: "",
                  });
                  fetchList(1);
                }}
                className="btn px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Requested Date</th>
                  <th className="px-6 py-4 border-r border-border/20">Order Details</th>
                  <th className="px-6 py-4 border-r border-border/20">Customer User</th>
                  <th className="px-6 py-4 border-r border-border/20">Target Items</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20">Proof Attachment</th>
                  <th className="px-6 py-4 border-r border-border/20">Eligibility Window</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-medium text-foreground">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center bg-secondary/5">
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : resp.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                      No return requests currently compiled.
                    </td>
                  </tr>
                ) : (
                  resp.data.map((rr) => {
                    const attachment = rr.attachments?.[0];
                    const orderId =
                      typeof rr.order === "string" ? rr.order : rr.order._id;
                    const dAt = deliveredAtCache[orderId];
                    const left = dAt ? daysLeft(dAt) : null;
                    const leftText =
                      left == null
                        ? "—"
                        : left > 0
                        ? `${left} day${left === 1 ? "" : "s"} left`
                        : "Expired";
                    return (
                      <tr key={rr._id} className="hover:bg-secondary/5 transition-colors">
                        <td className="px-6 py-4 border-r border-border/20 text-muted-foreground">
                          {new Date(rr.requestedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {shortId(orderId)}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {typeof rr.order !== "string" &&
                              rr.order.totalAmount != null
                                ? `₹${rr.order.totalAmount}`
                                : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="flex flex-col">
                            <span className="text-foreground font-semibold">
                              {typeof rr.user === "string"
                                ? shortId(rr.user)
                                : rr.user.name || rr.user.email}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title={typeof rr.user !== "string" ? rr.user.email : ""}>
                              {typeof rr.user !== "string" ? rr.user.email : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="space-y-1.5 leading-relaxed">
                            {rr.items.map((it, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-4 text-[10px]"
                              >
                                <span className="text-muted-foreground font-semibold">
                                  {(typeof it.product === "string"
                                    ? it.product
                                    : it.product?.title) || "Item"}{" "}
                                  × {it.qty}
                                </span>
                                <span className="text-foreground font-bold">
                                  ₹{(it.qty * it.price).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center">
                          <StatusBadge status={rr.status} />
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          {attachment ? (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-semibold"
                            >
                              {attachment.name || "attachment"}
                            </a>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20">
                          <span
                            className={`text-xs font-semibold ${
                              left === 0 ? "text-rose-500" : "text-muted-foreground"
                            }`}
                            title={dAt || ""}
                          >
                            {leftText}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-wrap gap-2 justify-center">
                            <button
                              onClick={() => openDetails(rr)}
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Details
                            </button>
                            {canTransition(rr, "approved") && (
                              <button
                                onClick={() => openAction(rr, "approved")}
                                className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Approve
                              </button>
                            )}
                            {canTransition(rr, "rejected") && (
                              <button
                                onClick={() => openAction(rr, "rejected")}
                                className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Reject
                              </button>
                            )}
                            {canTransition(rr, "received") && (
                              <button
                                onClick={() => openAction(rr, "received")}
                                className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Mark received
                              </button>
                            )}
                            {canTransition(rr, "refunded") && (
                              <button
                                onClick={() => openAction(rr, "refunded")}
                                className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Refund
                              </button>
                            )}
                            {canTransition(rr, "cancelled") && (
                              <button
                                onClick={() => openAction(rr, "cancelled")}
                                className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/25 bg-secondary/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Page {resp.page} of{" "}
              {Math.max(1, Math.ceil(resp.total / resp.limit))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={loading || page <= 1}
                className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={nextPage}
                disabled={loading || !resp.hasNext}
                className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Action Modal */}
        {open && target && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl bg-card border border-border/40 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
                <h3 className="display-font text-lg font-semibold tracking-wide text-foreground">
                  Update Return Status
                </h3>
                <button
                  onClick={() => {
                    setOpen(false);
                    setTarget(null);
                    setNote("");
                    setRefund({ method: "manual" });
                  }}
                  className="btn px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-semibold text-foreground">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Request ID</div>
                    <div className="font-mono text-xs">{shortId(target._id)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Order ID</div>
                    <div className="font-mono text-xs">
                      {typeof target.order === "string"
                        ? target.order
                        : target.order._id}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Next status
                  </label>
                  <select
                    value={nextStatus}
                    aria-label="Next status selection"
                    onChange={(e) => setNextStatus(e.target.value as RRStatus)}
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    {statuses.map((s) => (
                      <option
                        key={s}
                        value={s}
                        disabled={
                          ![
                            "approved",
                            "rejected",
                            "received",
                            "refunded",
                            "cancelled",
                          ].includes(s)
                        }
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {nextStatus === "refunded" && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Method</label>
                      <select
                        value={refund.method}
                        aria-label="Refund method selection"
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            method: e.target.value as any,
                          }))
                        }
                        className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      >
                        <option value="manual">manual</option>
                        <option value="bank">bank</option>
                        <option value="upi">upi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Reference
                      </label>
                      <input
                        value={refund.reference || ""}
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            reference: e.target.value,
                          }))
                        }
                        placeholder="txn/ref id"
                        className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={refund.amount ?? ""}
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            amount: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                        className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Note (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note/reason…"
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/20 bg-secondary/10">
                <button
                  onClick={() => {
                    setOpen(false);
                    setTarget(null);
                    setNote("");
                    setRefund({ method: "manual" });
                  }}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAction}
                  disabled={submitting}
                  className="btn-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Update Ticket"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {detailsOpen && detailsTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl bg-card border border-border/40 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 sticky top-0 bg-card z-10">
                <h3 className="display-font text-lg font-semibold tracking-wide text-foreground">
                  Return Ticket Details
                </h3>
                <button
                  onClick={() => {
                    setDetailsOpen(false);
                    setDetailsTarget(null);
                  }}
                  className="btn px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-6 text-xs font-semibold text-foreground">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Request ID</div>
                    <div className="font-mono text-xs">{detailsTarget._id}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Requested Time</div>
                    <div className="text-foreground">
                      {new Date(detailsTarget.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Order Reference</div>
                    <div className="text-foreground font-mono">
                      {typeof detailsTarget.order === "string"
                        ? detailsTarget.order
                        : detailsTarget.order._id}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Customer User</div>
                    <div className="text-foreground">
                      {typeof detailsTarget.user === "string"
                        ? detailsTarget.user
                        : `${
                            detailsTarget.user.name || detailsTarget.user.email
                          } (${detailsTarget.user.email || "—"})`}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Ticket Status</div>
                    <StatusBadge status={detailsTarget.status} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Eligibility Window</div>
                    <div className="text-foreground">
                      {(() => {
                        const orderId =
                          typeof detailsTarget.order === "string"
                            ? detailsTarget.order
                            : detailsTarget.order._id;
                        const dAt = deliveredAtCache[orderId];
                        if (!dAt) return "—";
                        const left = daysLeft(dAt);
                        return left != null
                          ? left > 0
                            ? `${left} day${left === 1 ? "" : "s"} left`
                            : "Expired"
                          : "—";
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Return Reason</div>
                    <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {detailsTarget.reason || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Operator Notes</div>
                    <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {detailsTarget.note || "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Claim Items</div>
                  <div className="border border-border/40 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-secondary/25 border-b border-border/35">
                          <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                            <th className="px-4 py-3 border-r border-border/20">Product Title</th>
                            <th className="px-4 py-3 border-r border-border/20 text-center">Qty</th>
                            <th className="px-4 py-3 border-r border-border/20 text-right">Price</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-medium text-foreground">
                          {detailsTarget.items.map((it, i) => (
                            <tr key={i} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-4 py-3 border-r border-border/20">
                                {(typeof it.product === "string"
                                  ? it.product
                                  : it.product?.title) || "Item"}
                              </td>
                              <td className="px-4 py-3 border-r border-border/20 text-center">{it.qty}</td>
                              <td className="px-4 py-3 border-r border-border/20 text-right">
                                ₹{it.price.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-3 text-right font-bold">
                                ₹{(it.qty * it.price).toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Claim Attachment</div>
                  {detailsTarget.attachments?.[0] ? (
                    <div className="space-y-2">
                      {isImageUrl(detailsTarget.attachments[0].url) ? (
                        <img
                          src={detailsTarget.attachments[0].url}
                          alt={
                            detailsTarget.attachments[0].name || "attachment"
                          }
                          className="max-h-64 rounded-xl border border-border/40 object-contain shadow-soft bg-white"
                          onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).src =
                              "/fallback.png")
                          }
                        />
                      ) : isVideoUrl(detailsTarget.attachments[0].url) ? (
                        <video
                          src={detailsTarget.attachments[0].url}
                          controls
                          className="w-full rounded-xl border border-border/40 shadow-soft"
                        />
                      ) : (
                        <a
                          href={detailsTarget.attachments[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-bold"
                        >
                          {detailsTarget.attachments[0].name || "Download Asset File"}
                        </a>
                      )}
                      <div className="text-[10px]">
                        <a
                          href={detailsTarget.attachments[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-bold uppercase tracking-wider"
                        >
                          Open in new browser tab
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">—</div>
                  )}
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Timeline Lifecycle</div>
                  <div className="grid md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                    <div>
                      <span className="font-bold text-foreground">Requested: </span>
                      <span>
                        {detailsTarget.requestedAt
                          ? new Date(detailsTarget.requestedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Approved: </span>
                      <span>
                        {detailsTarget.approvedAt
                          ? new Date(detailsTarget.approvedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Rejected: </span>
                      <span>
                        {detailsTarget.rejectedAt
                          ? new Date(detailsTarget.rejectedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Received: </span>
                      <span>
                        {detailsTarget.receivedAt
                          ? new Date(detailsTarget.receivedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Refunded: </span>
                      <span>
                        {detailsTarget.refundedAt
                          ? new Date(detailsTarget.refundedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Cancelled: </span>
                      <span>
                        {detailsTarget.cancelledAt
                          ? new Date(detailsTarget.cancelledAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {detailsTarget.status === "refunded" &&
                  detailsTarget.refund && (
                    <div className="border-t border-border/25 pt-4">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Refund Meta</div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Method</div>
                          <div className="text-foreground font-semibold mt-0.5">
                            {detailsTarget.refund.method || "manual"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Reference</div>
                          <div className="text-foreground font-semibold mt-0.5">
                            {detailsTarget.refund.reference || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Amount</div>
                          <div className="text-foreground font-semibold mt-0.5">
                            {detailsTarget.refund.amount != null
                              ? `₹${detailsTarget.refund.amount.toLocaleString(
                                  "en-IN"
                                )}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminReturnsPage), { ssr: false });
