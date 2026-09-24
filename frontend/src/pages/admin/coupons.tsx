import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency } from "../../utils/format";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type Coupon = {
  _id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt?: string;
  expiresAt?: string;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  perUserLimit?: number;
  description?: string;
  allowedCategories?: string[];
  allowedBrands?: string[];
  createdAt?: string;
};

type Category = { _id: string; name: string; slug: string; active: boolean };

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider ${
        active
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-500 border-rose-500/20"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminCouponsPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "coupons:read");
  const canWrite = hasPerm(user as any, "coupons:write");

  const [list, setList] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  // editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Partial<Coupon>>({
    code: "",
    type: "percent",
    value: 10,
    active: true,
    minOrderValue: 0,
    allowedCategories: [],
    allowedBrands: [],
  });

  const load = async () => {
    setLoading(true);
    try {
      const calls: Promise<any>[] = [];
      if (canRead) calls.push(api.get("/admin/coupons"));
      calls.push(api.get("/categories"));
      const results = await Promise.all(calls);
      const couponsRes = canRead ? results[0] : null;
      const catsRes = results[canRead ? 1 : 0];
      if (couponsRes) setList(couponsRes.data || []);
      setCategories((catsRes.data || []).filter((c: Category) => c.active));
    } catch {
      if (canRead) toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const startCreate = () => {
    if (!canWrite) {
      toast.error("You don't have permission to create coupons");
      return;
    }
    setEditing(null);
    setForm({
      code: "",
      type: "percent",
      value: 10,
      active: true,
      minOrderValue: 0,
      maxDiscount: undefined,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: undefined,
      expiresAt: undefined,
      description: "",
      allowedCategories: [],
      allowedBrands: [],
    });
    setEditorOpen(true);
  };

  const startEdit = (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don't have permission to edit coupons");
      return;
    }
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      active: c.active,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      usageLimit: c.usageLimit,
      perUserLimit: c.perUserLimit,
      startsAt: c.startsAt ? c.startsAt.substring(0, 16) : undefined,
      expiresAt: c.expiresAt ? c.expiresAt.substring(0, 16) : undefined,
      description: c.description || "",
      allowedCategories: c.allowedCategories || [],
      allowedBrands: c.allowedBrands || [],
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to modify coupons");
      return;
    }
    const payload: any = { ...form };
    payload.code = String(payload.code || "")
      .toUpperCase()
      .trim();
    if (!payload.code) return toast.error("Code required");
    if (!payload.type) payload.type = "percent";
    if (Number(payload.value) <= 0) return toast.error("Value must be > 0");

    if (typeof payload.allowedBrands === "string") {
      payload.allowedBrands = payload.allowedBrands
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    try {
      if (editing) {
        await api.patch(`/admin/coupons/${editing._id}`, payload);
        toast.success("Coupon updated successfully");
      } else {
        await api.post("/admin/coupons", payload);
        toast.success("Coupon created successfully");
      }
      setEditing(null);
      setEditorOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditorOpen(false);
    setForm({
      code: "",
      type: "percent",
      value: 10,
      active: true,
      minOrderValue: 0,
      maxDiscount: undefined,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: undefined,
      expiresAt: undefined,
      description: "",
      allowedCategories: [],
      allowedBrands: [],
    });
  };

  const toggleActive = async (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don't have permission to update coupons");
      return;
    }
    try {
      await api.patch(`/admin/coupons/${c._id}`, { active: !c.active });
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const del = async (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don't have permission to delete coupons");
      return;
    }
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${c._id}`);
      toast.success("Deleted successfully");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const colCount = useMemo(() => (canWrite ? 11 : 10), [canWrite]);

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between border-b border-border/40 pb-5 mb-8 flex-wrap gap-4">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Discount Coupons</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure seasonal discounts, fixed rates, usage parameters, and merchant codes.
            </p>
          </div>
          <PermissionGate perm="coupons:write">
            <button
              onClick={startCreate}
              className="btn-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              + Create Coupon
            </button>
          </PermissionGate>
        </div>

        {!canRead ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-8 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            You don&apos;t have access to Coupons logs or editor.
          </div>
        ) : (
          <>
            {/* Editor (write only) */}
            {editorOpen && canWrite && (
              <div className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
                  {editing ? "Update Coupon Metadata" : "Create New Coupon Schema"}
                </h3>
                <div className="grid md:grid-cols-3 gap-6 text-xs font-semibold">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Coupon Code
                    </label>
                    <input
                      value={form.code || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="e.g. SAVE10"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Rate Type
                    </label>
                    <select
                      value={form.type || "percent"}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value as any }))
                      }
                      className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    >
                      <option value="percent">Percentage Discount</option>
                      <option value="fixed">Fixed Currency Discount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Discount Value
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.value ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          value: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Initial Status
                    </label>
                    <select
                      value={String(form.active ?? true)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          active: e.target.value === "true",
                        }))
                      }
                      className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    >
                      <option value="true">Active and Redeemable</option>
                      <option value="false">Inactive / Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Min Order Value Requirement
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.minOrderValue ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          minOrderValue: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="0"
                    />
                  </div>

                  {form.type === "percent" && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Max Discount Cap Value
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.maxDiscount ?? 0}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            maxDiscount: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                        placeholder="Optional"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Global Total Usage Limit
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.usageLimit ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          usageLimit: Number(e.target.value) || undefined,
                        }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="Optional limit"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Per User Usage Limit
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.perUserLimit ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          perUserLimit: Number(e.target.value) || undefined,
                        }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="Optional limit"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Activation Date (Starts At)
                    </label>
                    <input
                      type="datetime-local"
                      value={(form.startsAt as any) || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          startsAt: e.target.value || undefined,
                        }))
                      }
                      className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Expiration Date (Expires At)
                    </label>
                    <input
                      type="datetime-local"
                      value={(form.expiresAt as any) || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          expiresAt: e.target.value || undefined,
                        }))
                      }
                      className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Description Note
                    </label>
                    <input
                      value={form.description || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="e.g. VIP Member Discount, Black Friday Season"
                    />
                  </div>

                  {/* Scope: categories */}
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Allowed Scoped Categories
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const checked = (form.allowedCategories || []).includes(
                          c.name
                        );
                        return (
                          <label
                            key={c._id}
                            className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border rounded-md px-3 py-1.5 cursor-pointer transition-all duration-200 ${
                              checked
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-card/40 border-border/30 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              className="w-3.5 h-3.5 text-primary border-border focus:ring-0 focus:ring-offset-0"
                              onChange={(e) => {
                                setForm((f) => {
                                  const arr = new Set(
                                    f.allowedCategories || []
                                  );
                                  if (e.target.checked) arr.add(c.name);
                                  else arr.delete(c.name);
                                  return {
                                    ...f,
                                    allowedCategories: Array.from(arr),
                                  };
                                });
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      Leave all unselected to apply discount universally across all product categories.
                    </p>
                  </div>

                  {/* Scope: brands */}
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Allowed Scoped Brands (Comma-separated)
                    </label>
                    <input
                      value={
                        Array.isArray(form.allowedBrands)
                          ? form.allowedBrands.join(", ")
                          : (form.allowedBrands as any) || ""
                      }
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          allowedBrands: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                      placeholder="e.g. Prada, Rolex, Gucci"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      Leave empty to apply discount to all manufacturer brands.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex gap-3 pt-4 border-t border-border/20 justify-end">
                  <button
                    onClick={cancelEdit}
                    className="btn px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    className="btn-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
                  >
                    {editing ? "Update Coupon" : "Create Coupon"}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-secondary/25 border-b border-border/35">
                    <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-6 py-4 border-r border-border/20">Code</th>
                      <th className="px-6 py-4 border-r border-border/20">Type</th>
                      <th className="px-6 py-4 border-r border-border/20 text-right">Value</th>
                      <th className="px-6 py-4 border-r border-border/20 text-center">Active</th>
                      <th className="px-6 py-4 border-r border-border/20">Categories & Brands Scope</th>
                      <th className="px-6 py-4 border-r border-border/20">Date Window</th>
                      <th className="px-6 py-4 border-r border-border/20 text-right">Min Order</th>
                      <th className="px-6 py-4 border-r border-border/20 text-right">Max Cap</th>
                      <th className="px-6 py-4 border-r border-border/20 text-center">Usage Count</th>
                      <th className="px-6 py-4 border-r border-border/20 text-center">Per User</th>
                      {canWrite && (
                        <th className="px-6 py-4 text-center">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-10 text-center bg-secondary/5" colSpan={colCount}>
                          <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                        </td>
                      </tr>
                    ) : !list.length ? (
                      <tr>
                        <td className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5" colSpan={colCount}>
                          No active or inactive coupons configured.
                        </td>
                      </tr>
                    ) : (
                      list.map((c) => (
                        <tr
                          key={c._id}
                          className="hover:bg-secondary/5 transition-colors font-medium text-foreground"
                        >
                          <td className="px-6 py-4 border-r border-border/20 font-bold text-primary">{c.code}</td>
                          <td className="px-6 py-4 border-r border-border/20 text-muted-foreground uppercase">{c.type}</td>
                          <td className="px-6 py-4 border-r border-border/20 text-right font-semibold">
                            {c.type === "percent"
                              ? `${c.value}%`
                              : currency(c.value)}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-center">
                            <StatusBadge active={c.active} />
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-xs text-muted-foreground">
                            {c.allowedCategories && c.allowedCategories.length
                              ? `Cat: ${c.allowedCategories.join(", ")} `
                              : "Cat: All "}
                            {c.allowedBrands && c.allowedBrands.length
                              ? `| Brand: ${c.allowedBrands.join(", ")}`
                              : "| Brand: All"}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-muted-foreground whitespace-nowrap">
                            {c.startsAt
                              ? new Date(c.startsAt).toLocaleDateString()
                              : "—"}{" "}
                            →{" "}
                            {c.expiresAt
                              ? new Date(c.expiresAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-right text-muted-foreground font-semibold">
                            {c.minOrderValue ? currency(c.minOrderValue) : "—"}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-right text-muted-foreground font-semibold">
                            {c.maxDiscount ? currency(c.maxDiscount) : "—"}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-center font-semibold">
                            {c.usedCount ?? 0}
                            {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                          </td>
                          <td className="px-6 py-4 border-r border-border/20 text-center text-muted-foreground">{c.perUserLimit ?? "—"}</td>

                          {canWrite && (
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => startEdit(c)}
                                  className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleActive(c)}
                                  className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  {c.active ? "Disable" : "Enable"}
                                </button>
                                <button
                                  onClick={() => del(c)}
                                  className="btn border-rose-500/30 text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
