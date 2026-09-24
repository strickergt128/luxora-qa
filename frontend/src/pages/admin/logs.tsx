import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";

type OrderAudit = {
  _id: string;
  order: string;
  fromStatus:
    | "pending"
    | "confirmed"
    | "shipped"
    | "delivered"
    | "cancelled"
    | null;
  toStatus: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  changedBy?: { _id: string; name?: string; email?: string; role?: string };
  changedByRole?: "user" | "seller" | "admin" | "system";
  context: "user" | "seller" | "admin" | "system";
  note?: string;
  meta?: { ip?: string; ua?: string };
  createdAt: string;
};

type AdminAction = {
  _id: string;
  action: string;
  entityType:
    | "user"
    | "product"
    | "order"
    | "coupon"
    | "media"
    | "emailTemplate"
    | "sellerRequest"
    | "banner"
    | "sponsored";
  entityId: string;
  summary?: string;
  before?: any;
  after?: any;
  note?: string;
  changedBy?: { _id: string; name?: string; email?: string; role?: string };
  meta?: { ip?: string; ua?: string };
  createdAt: string;
};

type Paged<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

const orderStatuses = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;
const contexts = ["user", "seller", "admin", "system"] as const;
const entityTypes = [
  "user",
  "product",
  "order",
  "coupon",
  "media",
  "emailTemplate",
  "sellerRequest",
  "banner",
  "sponsored",
] as const;

function StatusBadge({ text, status }: { text: string; status?: string | null }) {
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

function ContextBadge({ text }: { text: string }) {
  const badgeStyle = () => {
    switch (text) {
      case "admin":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "seller":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "user":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
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

const shortId = (id: string) =>
  id?.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

export default function AdminLogsPage() {
  const router = useRouter();
  const bootstrappedRef = useRef(false);

  const [tab, setTab] = useState<"orders" | "actions">("orders");

  // Orders tab state
  const [oFilters, setOFilters] = useState({
    orderId: "",
    changedBy: "",
    toStatus: "",
    context: "",
    from: "",
    to: "",
  });
  const [oPage, setOPage] = useState(1);
  const [oLimit] = useState(20);
  const [oLoading, setOLoading] = useState(false);
  const [oResp, setOResp] = useState<Paged<OrderAudit>>({
    data: [],
    page: 1,
    limit: oLimit,
    total: 0,
    hasNext: false,
  });
  const [oDetail, setODetail] = useState<OrderAudit | null>(null);

  // Actions tab state
  const [aFilters, setAFilters] = useState({
    action: "",
    entityType: "",
    entityId: "",
    changedBy: "",
    q: "",
    from: "",
    to: "",
  });
  const [aPage, setAPage] = useState(1);
  const [aLimit] = useState(20);
  const [aLoading, setALoading] = useState(false);
  const [aResp, setAResp] = useState<Paged<AdminAction>>({
    data: [],
    page: 1,
    limit: aLimit,
    total: 0,
    hasNext: false,
  });
  const [aDetail, setADetail] = useState<AdminAction | null>(null);

  // Fetchers
  const fetchOrderLogs = async (pageArg = oPage) => {
    setOLoading(true);
    try {
      const params: any = { page: pageArg, limit: oLimit };
      for (const [k, v] of Object.entries(oFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/logs/orders", { params });
      setOResp(data);
      setOPage(data.page);
    } catch (err) {
      console.error("Order logs error:", err);
      setOResp({ data: [], page: 1, limit: oLimit, total: 0, hasNext: false });
    } finally {
      setOLoading(false);
    }
  };

  const fetchActionLogs = async (pageArg = aPage) => {
    setALoading(true);
    try {
      const params: any = { page: pageArg, limit: aLimit };
      for (const [k, v] of Object.entries(aFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/logs/actions", { params });
      setAResp(data);
      setAPage(data.page);
    } catch (err) {
      console.error("Action logs error:", err);
      setAResp({ data: [], page: 1, limit: aLimit, total: 0, hasNext: false });
    } finally {
      setALoading(false);
    }
  };

  // Auto-apply orderId from query once
  useEffect(() => {
    if (!router.isReady || bootstrappedRef.current) return;

    const orderIdFromQuery =
      typeof router.query.orderId === "string" ? router.query.orderId : "";

    if (orderIdFromQuery) {
      setOFilters((f) =>
        f.orderId === orderIdFromQuery ? f : { ...f, orderId: orderIdFromQuery }
      );
      setTab("orders");
      fetchOrderLogs(1);
    } else {
      fetchOrderLogs(1);
    }
    bootstrappedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.orderId]);

  useEffect(() => {
    if (tab === "actions" && aResp.total === 0 && !aLoading) {
      fetchActionLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Pagination handlers
  const oPrev = () => {
    if (oLoading || oPage <= 1) return;
    fetchOrderLogs(oPage - 1);
  };
  const oNext = () => {
    if (oLoading || !oResp.hasNext) return;
    fetchOrderLogs(oPage + 1);
  };
  const aPrev = () => {
    if (aLoading || aPage <= 1) return;
    fetchActionLogs(aPage - 1);
  };
  const aNext = () => {
    if (aLoading || !aResp.hasNext) return;
    fetchActionLogs(aPage + 1);
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between border-b border-border/40 pb-5 mb-8 flex-wrap gap-4">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Audit Logs</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Audit status transition logs and general administrative changes recorded on the platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTab("orders")}
              className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                tab === "orders"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/40 border border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              Order Changes
            </button>
            <button
              onClick={() => setTab("actions")}
              className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                tab === "actions"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/40 border border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin Actions
            </button>
          </div>
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-8">
            <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
                Filter Logs
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Order ID
                  </label>
                  <input
                    value={oFilters.orderId}
                    aria-label="Order ID filter"
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, orderId: e.target.value }))
                    }
                    placeholder="e.g. 65f...d2a"
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Changed By
                  </label>
                  <input
                    value={oFilters.changedBy}
                    aria-label="Changed by filter"
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="Email or ID"
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    To Status
                  </label>
                  <select
                    value={oFilters.toStatus}
                    aria-label="To status filter"
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, toStatus: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    <option value="">All</option>
                    {orderStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Context
                  </label>
                  <select
                    value={oFilters.context}
                    aria-label="Context filter"
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, context: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    <option value="">All</option>
                    {contexts.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    From
                  </label>
                  <input
                    type="date"
                    aria-label="From date filter"
                    value={oFilters.from}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">To</label>
                  <input
                    type="date"
                    aria-label="To date filter"
                    value={oFilters.to}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-3 border-t border-border/20 justify-end">
                <button
                  onClick={() => {
                    setOFilters({
                      orderId: "",
                      changedBy: "",
                      toStatus: "",
                      context: "",
                      from: "",
                      to: "",
                    });
                    fetchOrderLogs(1);
                  }}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Reset
                </button>
                <button
                  onClick={() => fetchOrderLogs(1)}
                  className="btn-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-secondary/25 border-b border-border/35">
                    <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-6 py-4 border-r border-border/20">Date</th>
                      <th className="px-6 py-4 border-r border-border/20">Order ID</th>
                      <th className="px-6 py-4 border-r border-border/20">From → To</th>
                      <th className="px-6 py-4 border-r border-border/20">Context</th>
                      <th className="px-6 py-4 border-r border-border/20">Changed By</th>
                      <th className="px-6 py-4 border-r border-border/20">Note</th>
                      <th className="px-6 py-4 border-r border-border/20">IP Address</th>
                      <th className="px-6 py-4 border-r border-border/20">User Agent</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {oLoading ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center bg-secondary/5">
                          <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                        </td>
                      </tr>
                    ) : oResp.data.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                          No logs found.
                        </td>
                      </tr>
                    ) : (
                      oResp.data.map((a) => (
                        <tr key={a._id} className="hover:bg-secondary/5 transition-colors">
                          <td className="px-6 py-4 border-r border-border/20 text-muted-foreground font-semibold whitespace-nowrap">
                            {new Date(a.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 font-bold text-foreground">
                            <span title={a.order}>
                              {shortId(a.order)}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            <div className="flex items-center gap-2">
                              {a.fromStatus ? (
                                <StatusBadge
                                  text={a.fromStatus}
                                  status={a.fromStatus}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                              <span className="text-muted-foreground">→</span>
                              <StatusBadge
                                text={a.toStatus}
                                status={a.toStatus}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            <ContextBadge text={a.context} />
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            {a.changedBy ? (
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">
                                  {a.changedBy.name || a.changedBy.email}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {a.changedBy.email}
                                </span>
                                <span className="bg-primary/10 text-primary border border-primary/20 rounded-sm px-1.5 py-0.5 font-bold uppercase tracking-wider text-[8px] w-fit mt-1.5">
                                  {a.changedBy.role}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-semibold uppercase text-[9px]">system</span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-foreground">
                            <span className="line-clamp-2 max-w-[200px]" title={a.note}>
                              {a.note || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-foreground font-mono text-[10px] whitespace-nowrap">
                            {a.meta?.ip || "—"}
                          </td>
                          <td
                            className="px-6 py-4 border-r border-border/20 text-muted-foreground truncate max-w-[150px]"
                            title={a.meta?.ua}
                          >
                            {a.meta?.ua || "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setODetail(a)}
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 bg-secondary/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Page {oResp.page} of {Math.max(1, Math.ceil(oResp.total / oResp.limit))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={oPrev}
                    disabled={oLoading || oPage <= 1}
                    className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={oNext}
                    disabled={oLoading || !oResp.hasNext}
                    className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Order log details modal */}
            {oDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-xl bg-card border border-border/40 shadow-soft max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/35 bg-secondary/15 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                      Order Log Audit Detail
                    </h3>
                    <button
                      onClick={() => setODetail(null)}
                      className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Creation date</div>
                        <div className="text-foreground font-semibold">
                          {new Date(oDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Order Object</div>
                        <div className="text-foreground font-mono font-semibold break-all">{oDetail.order}</div>
                      </div>
                      <div className="col-span-2 bg-secondary/10 p-4 border border-border/30 rounded-lg flex flex-col items-center justify-center gap-3">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Transition State</div>
                        <div className="flex items-center gap-4">
                          {oDetail.fromStatus ? (
                            <StatusBadge
                              text={oDetail.fromStatus}
                              status={oDetail.fromStatus}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          <span className="text-muted-foreground font-bold">→</span>
                          <StatusBadge
                            text={oDetail.toStatus}
                            status={oDetail.toStatus}
                          />
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Context</div>
                        <ContextBadge text={oDetail.context} />
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Changed By</div>
                        <div className="text-foreground font-semibold truncate">
                          {oDetail.changedBy
                            ? `${
                                oDetail.changedBy.name || oDetail.changedBy.email
                              } (${oDetail.changedBy.role})`
                            : "system"}
                        </div>
                        {oDetail.changedBy?.email && (
                          <div className="text-[9px] text-muted-foreground mt-1 truncate">
                            {oDetail.changedBy.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-secondary/10 p-4 border border-border/30 rounded-lg">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Log Note / Reason</div>
                      <div className="text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                        {oDetail.note || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">IP Address</div>
                        <div className="text-foreground font-mono">
                          {oDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">User Agent</div>
                        <div className="text-muted-foreground font-mono break-all leading-normal text-[10px]">
                          {oDetail.meta?.ua || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Actions tab */}
        {tab === "actions" && (
          <div className="space-y-8">
            <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
                Filter Actions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Action
                  </label>
                  <input
                    value={aFilters.action}
                    aria-label="Action filter"
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, action: e.target.value }))
                    }
                    placeholder="e.g. order.status.update"
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Entity Type
                  </label>
                  <select
                    value={aFilters.entityType}
                    aria-label="Entity type filter"
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityType: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    <option value="">All</option>
                    {entityTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Entity ID
                  </label>
                  <input
                    value={aFilters.entityId}
                    aria-label="Entity ID filter"
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityId: e.target.value }))
                    }
                    placeholder="ObjectId or Plain ID"
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Changed By
                  </label>
                  <input
                    value={aFilters.changedBy}
                    aria-label="Changed by filter"
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="Email or ID"
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Search Summary
                  </label>
                  <input
                    value={aFilters.q}
                    aria-label="Search summary filter"
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, q: e.target.value }))
                    }
                    placeholder='e.g. "Deleted product"'
                    className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    aria-label="From date action filter"
                    value={aFilters.from}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">To Date</label>
                  <input
                    type="date"
                    aria-label="To date action filter"
                    value={aFilters.to}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-3 border-t border-border/20 justify-end">
                <button
                  onClick={() => {
                    setAFilters({
                      action: "",
                      entityType: "",
                      entityId: "",
                      changedBy: "",
                      q: "",
                      from: "",
                      to: "",
                    });
                    fetchActionLogs(1);
                  }}
                  className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Reset
                </button>
                <button
                  onClick={() => fetchActionLogs(1)}
                  className="btn-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-secondary/25 border-b border-border/35">
                    <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-6 py-4 border-r border-border/20">Date</th>
                      <th className="px-6 py-4 border-r border-border/20">Action</th>
                      <th className="px-6 py-4 border-r border-border/20">Entity</th>
                      <th className="px-6 py-4 border-r border-border/20">Summary</th>
                      <th className="px-6 py-4 border-r border-border/20">Changed By</th>
                      <th className="px-6 py-4 border-r border-border/20">IP Address</th>
                      <th className="px-6 py-4 border-r border-border/20">User Agent</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {aLoading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center bg-secondary/5">
                          <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                        </td>
                      </tr>
                    ) : aResp.data.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                          No logs found.
                        </td>
                      </tr>
                    ) : (
                      aResp.data.map((log) => (
                        <tr key={log._id} className="hover:bg-secondary/5 transition-colors">
                          <td className="px-6 py-4 border-r border-border/20 text-muted-foreground font-semibold whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            <span className="bg-primary/10 text-primary border border-primary/20 rounded-sm px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] whitespace-nowrap">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            <div className="flex flex-col">
                              <span className="text-foreground font-semibold uppercase">
                                {log.entityType}
                              </span>
                              <span
                                className="text-[10px] text-muted-foreground mt-0.5"
                                title={log.entityId}
                              >
                                {shortId(log.entityId)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-foreground font-medium">
                            <span className="line-clamp-2 max-w-[250px]" title={log.summary}>
                              {log.summary || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r border-border/20">
                            {log.changedBy ? (
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">
                                  {log.changedBy.name || log.changedBy.email}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {log.changedBy.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-foreground font-mono text-[10px] whitespace-nowrap">
                            {log.meta?.ip || "—"}
                          </td>
                          <td
                            className="px-6 py-4 border-r border-border/20 text-muted-foreground truncate max-w-[150px]"
                            title={log.meta?.ua}
                          >
                            {log.meta?.ua || "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setADetail(log)}
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 bg-secondary/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Page {aResp.page} of {Math.max(1, Math.ceil(aResp.total / aResp.limit))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={aPrev}
                    disabled={aLoading || aPage <= 1}
                    className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={aNext}
                    disabled={aLoading || !aResp.hasNext}
                    className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Action details modal */}
            {aDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="w-full max-w-4xl rounded-xl bg-card border border-border/40 shadow-soft max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/35 bg-secondary/15 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                      System Action Audit Detail
                    </h3>
                    <button
                      onClick={() => setADetail(null)}
                      className="btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 text-xs">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Creation date</div>
                        <div className="text-foreground font-semibold">
                          {new Date(aDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Action Identity</div>
                        <div className="text-primary font-semibold bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 inline-block uppercase w-fit">{aDetail.action}</div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Entity Reference</div>
                        <div className="text-foreground font-semibold uppercase">
                          <span className="text-primary">{aDetail.entityType}</span>
                          <span className="text-muted-foreground mx-2">·</span>
                          <span className="font-mono">{aDetail.entityId}</span>
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Changed By</div>
                        <div className="text-foreground font-semibold truncate">
                          {aDetail.changedBy
                            ? `${
                                aDetail.changedBy.name ||
                                aDetail.changedBy.email
                              } (${aDetail.changedBy.role || "admin"})`
                            : "—"}
                        </div>
                        {aDetail.changedBy?.email && (
                          <div className="text-[9px] text-muted-foreground mt-1 truncate">
                            {aDetail.changedBy.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-secondary/10 p-4 border border-border/30 rounded-lg">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Summary</div>
                      <div className="text-foreground font-semibold">
                        {aDetail.summary || "—"}
                      </div>
                    </div>

                    {aDetail.note && (
                      <div className="bg-secondary/10 p-4 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Log Note</div>
                        <div className="text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                          {aDetail.note}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="border border-border/30 rounded-xl overflow-hidden flex flex-col">
                        <div className="bg-secondary/15 border-b border-border/25 p-3">
                           <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">State Before Change</div>
                        </div>
                        <pre className="bg-card/45 p-4 overflow-auto max-h-64 text-[10px] font-mono text-muted-foreground flex-1 leading-normal">
                          {JSON.stringify(aDetail.before ?? null, null, 2)}
                        </pre>
                      </div>
                      <div className="border border-border/30 rounded-xl overflow-hidden flex flex-col">
                        <div className="bg-secondary/15 border-b border-border/25 p-3">
                           <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">State After Change</div>
                        </div>
                        <pre className="bg-card/45 p-4 overflow-auto max-h-64 text-[10px] font-mono text-muted-foreground flex-1 leading-normal">
                          {JSON.stringify(aDetail.after ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">IP Address</div>
                        <div className="text-foreground font-mono">
                          {aDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div className="bg-secondary/10 p-3 border border-border/30 rounded-lg">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">User Agent</div>
                        <div className="text-muted-foreground font-mono break-all leading-normal text-[10px]">
                          {aDetail.meta?.ua || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
