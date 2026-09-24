import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import toast from "react-hot-toast";

type Placement = {
  _id: string;
  product:
    | string
    | {
        _id: string;
        title: string;
        brand?: string;
        price?: number;
        stock?: number;
      };
  seller?: string;
  status: "pending" | "approved" | "rejected" | "paused";
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  notes?: string;
  targetCategorySlug?: string;
  impressions?: number;
  clicks?: number;
  createdAt: string;
  updatedAt: string;
};

function StatusBadge({ status }: { status: Placement["status"] }) {
  const badgeStyle = () => {
    switch (status) {
      case "approved":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "paused":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "rejected":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
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

export default function SponsoredAdminPage() {
  const [list, setList] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<
    "" | "approved" | "pending" | "paused" | "rejected"
  >("");

  // Create form fields
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<Placement["status"]>("approved");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [targetCategorySlug, setTargetCategorySlug] = useState("");

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/sponsored", {
        params: filterStatus ? { status: filterStatus } : {},
      });
      setList(data || []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to load sponsored placements"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const create = async () => {
    if (!productId.trim()) {
      toast.error("Product ID is required");
      return;
    }
    try {
      await api.post("/admin/sponsored", {
        productId: productId.trim(),
        status,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        priority: Number(priority) || 0,
        notes: notes || undefined,
        targetCategorySlug: targetCategorySlug
          ? targetCategorySlug.trim().toLowerCase()
          : undefined,
      });
      toast.success("Sponsored listing created successfully");
      setProductId("");
      setStatus("approved");
      setStartAt("");
      setEndAt("");
      setPriority(0);
      setNotes("");
      setTargetCategorySlug("");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Create failed");
    }
  };

  const update = async (id: string, patch: Partial<Placement>) => {
    try {
      await api.patch(`/admin/sponsored/${id}`, patch);
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sponsored listing?")) return;
    try {
      await api.delete(`/admin/sponsored/${id}`);
      toast.success("Listing deleted successfully");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const toLocal = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        {/* Placement configuration block */}
        <section className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <div className="flex items-center justify-between border-b border-border/20 pb-4 mb-6 flex-wrap gap-4">
            <div>
              <h2 className="display-font text-2xl font-semibold tracking-wide text-foreground">Sponsored Listings</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Promote targeted merchant merchandise, control display rankings, and inspect placement impressions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                aria-label="Filter status selector"
                onChange={(e) =>
                  setFilterStatus(e.target.value as typeof filterStatus)
                }
                className="bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="">All statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={fetchList}
                className="btn px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Refresh List
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Product ID (Hex string)
              </label>
              <input
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Mongo _id of product"
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Listing Status</label>
              <select
                value={status}
                aria-label="Status selector form"
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Target Category Slug (optional)
              </label>
              <input
                value={targetCategorySlug}
                onChange={(e) => setTargetCategorySlug(e.target.value)}
                placeholder="e.g., watches"
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Start Date (startsAt)
              </label>
              <input
                type="datetime-local"
                value={startAt}
                aria-label="Start date selector"
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">End Date (endAt)</label>
              <input
                type="datetime-local"
                value={endAt}
                aria-label="End date selector"
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Display Rank Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value || 0))}
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Internal Notes (optional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal campaign description or comment"
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 pt-3 flex justify-end">
              <button
                onClick={create}
                className="btn-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Create Sponsored Placement
              </button>
            </div>
          </div>
        </section>

        {/* List */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Product & Brand</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20">Schedule & Targeting</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Priority</th>
                  <th className="px-6 py-4 border-r border-border/20">Performance Metrics</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center bg-secondary/5">
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                      No sponsored listings found.
                    </td>
                  </tr>
                ) : (
                  list.map((pl) => {
                    const prod =
                      typeof pl.product === "string"
                        ? undefined
                        : (pl.product as any);
                    return (
                      <tr key={pl._id} className="hover:bg-secondary/5 transition-colors font-medium text-foreground">
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="font-semibold text-foreground">
                            {prod?.title || pl.product}
                          </div>
                          {prod?.brand && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {prod.brand}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center">
                          <StatusBadge status={pl.status} />
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-muted-foreground">
                          <div className="text-[10px] leading-relaxed">
                            {toLocal(pl.startAt)} → {toLocal(pl.endAt)}
                          </div>
                          {pl.targetCategorySlug && (
                            <div className="text-[9px] font-semibold text-primary mt-1">
                              TARGET CATEGORY: {pl.targetCategorySlug}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center font-semibold">{pl.priority}</td>
                        <td className="px-6 py-4 border-r border-border/20 text-muted-foreground">
                          <div className="text-[10px] leading-relaxed">
                            <span className="font-semibold text-foreground">{pl.impressions || 0}</span> views<br />
                            <span className="font-semibold text-foreground">{pl.clicks || 0}</span> clicks
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                update(pl._id, { status: "approved" })
                              }
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => update(pl._id, { status: "paused" })}
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Pause
                            </button>
                            <button
                              onClick={() =>
                                update(pl._id, { status: "rejected" })
                              }
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => remove(pl._id)}
                              className="btn border-rose-500/30 text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AdminLayout>
    </ProtectedRoute>
  );
}
