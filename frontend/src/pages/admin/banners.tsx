import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import toast from "react-hot-toast";
import BannerHero from "../../components/BannerHero";

type Banner = {
  _id?: string;
  title?: string;
  altText?: string;
  imageUrl: string;
  linkUrl?: string;
  placement: "home_hero" | "category_header";
  categorySlug?: string;
  active: boolean;
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  impressions?: number;
  clicks?: number;
  updatedAt?: string;

  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

const emptyForm: Banner = {
  title: "",
  altText: "",
  imageUrl: "",
  linkUrl: "",
  placement: "home_hero",
  categorySlug: "",
  active: true,
  startAt: "",
  endAt: "",
  priority: 0,
  layout: "image_full",
  imagePosition: "right",
  imageFit: "contain",
  headline: "",
  subheadline: "",
  ctaLabel: "",
};

function toInputDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function BannersAdminPage() {
  const [list, setList] = useState<Banner[]>([]);
  const [form, setForm] = useState<Banner>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterPlacement, setFilterPlacement] = useState<
    "" | "home_hero" | "category_header"
  >("home_hero");

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/banners", {
        params: filterPlacement ? { placement: filterPlacement } : {},
      });
      setList(data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPlacement]);

  const startEdit = (b: Banner) => {
    setEditingId(b._id!);
    setForm({
      _id: b._id,
      title: b.title || "",
      altText: b.altText || "",
      imageUrl: b.imageUrl || "",
      linkUrl: b.linkUrl || "",
      placement: b.placement,
      categorySlug: b.categorySlug || "",
      active: Boolean(b.active),
      startAt: toInputDateTime(b.startAt as string),
      endAt: toInputDateTime(b.endAt as string),
      priority: b.priority || 0,
      layout: b.layout || "image_full",
      imagePosition: b.imagePosition || "right",
      imageFit: b.imageFit || "contain",
      headline: b.headline || "",
      subheadline: b.subheadline || "",
      ctaLabel: b.ctaLabel || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, placement: filterPlacement || "home_hero" });
  };

  const save = async () => {
    if (!form.imageUrl || !form.placement) {
      toast.error("Image URL and placement location are required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        altText: form.altText,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        placement: form.placement,
        categorySlug:
          form.placement === "category_header" ? form.categorySlug : undefined,
        active: form.active,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        priority: Number(form.priority) || 0,
        layout: form.layout,
        imagePosition: form.imagePosition,
        imageFit: form.imageFit,
        headline: form.headline,
        subheadline: form.subheadline,
        ctaLabel: form.ctaLabel,
      };

      if (editingId) {
        await api.put(`/admin/banners/${editingId}`, payload);
        toast.success("Banner updated successfully");
      } else {
        await api.post("/admin/banners", payload);
        toast.success("Banner created successfully");
      }
      await fetchList();
      resetForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      toast.success("Banner deleted successfully");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const previewBanner: Banner = {
    ...form,
    _id: "preview",
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        {/* Banner config block */}
        <section className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <div className="flex items-center justify-between border-b border-border/20 pb-4 mb-6 flex-wrap gap-4">
            <div>
              <h2 className="display-font text-2xl font-semibold tracking-wide text-foreground">Marketing Banners</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure promotional landing carousels, custom layouts, headers, and click statistics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterPlacement}
                aria-label="Placement selector"
                onChange={(e) => setFilterPlacement(e.target.value as any)}
                className="bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="">All placements</option>
                <option value="home_hero">Home — Hero</option>
                <option value="category_header">Category — Header</option>
              </select>
              <button
                onClick={resetForm}
                className="btn px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                New Form
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                {editingId
                  ? saving
                    ? "Updating..."
                    : "Update Banner"
                  : saving
                  ? "Creating..."
                  : "Create Banner"}
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="grid md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Placement Area
              </label>
              <select
                value={form.placement}
                aria-label="Placement selector form"
                onChange={(e) =>
                  setForm((f) => ({ ...f, placement: e.target.value as any }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="home_hero">Home — Hero Banner</option>
                <option value="category_header">Category — Header Banner</option>
              </select>
            </div>

            {form.placement === "category_header" && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Category Slug URL
                </label>
                <input
                  value={form.categorySlug || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categorySlug: e.target.value }))
                  }
                  placeholder="e.g., watches"
                  className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Display Layout</label>
              <select
                value={form.layout}
                aria-label="Display layout selector"
                onChange={(e) =>
                  setForm((f) => ({ ...f, layout: e.target.value as any }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="image_full">Image Only (Legacy Full Size)</option>
                <option value="split_asym">Split Layout (Asymmetric Content + Image)</option>
              </select>
            </div>

            {form.layout === "split_asym" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Image Alignment Position
                  </label>
                  <select
                    value={form.imagePosition}
                    aria-label="Image position selector"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        imagePosition: e.target.value as any,
                      }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    <option value="right">Right Side</option>
                    <option value="left">Left Side</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Image Box Fitting
                  </label>
                  <select
                    value={form.imageFit}
                    aria-label="Image fit selector"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        imageFit: e.target.value as any,
                      }))
                    }
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                  >
                    <option value="contain">Contain (Full Aspect Ratio)</option>
                    <option value="cover">Cover (Fill & Crop Boundaries)</option>
                  </select>
                </div>

                <div className="md:col-span-2 grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Main Headline Text
                    </label>
                    <input
                      value={form.headline || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, headline: e.target.value }))
                      }
                      placeholder="e.g. Modern Elegance Redefined"
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Subheadline Text
                    </label>
                    <input
                      value={form.subheadline || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subheadline: e.target.value }))
                      }
                      placeholder="e.g. Discover our luxury collection"
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      CTA Button Label
                    </label>
                    <input
                      value={form.ctaLabel || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ctaLabel: e.target.value }))
                      }
                      placeholder="e.g. Shop Collection"
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Image Asset URL
              </label>
              <input
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                placeholder="e.g. /uploads/image.png or URL"
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Target Redirect URL
              </label>
              <input
                value={form.linkUrl || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkUrl: e.target.value }))
                }
                placeholder="e.g. /products/watch-1"
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Schedule Activation (Start Date)
              </label>
              <input
                type="datetime-local"
                value={form.startAt || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startAt: e.target.value }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Schedule Termination (End Date)</label>
              <input
                type="datetime-local"
                value={form.endAt || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endAt: e.target.value }))
                }
                className="w-full bg-card/60 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Display Priority Sorting Rank
              </label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: Number(e.target.value || 0),
                  }))
                }
                className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                className="w-4 h-4 text-primary border-border focus:ring-0 focus:ring-offset-0 rounded-md"
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              <label htmlFor="active" className="text-xs font-bold uppercase tracking-wider text-foreground select-none cursor-pointer">
                Active & Visible
              </label>
            </div>
          </div>
        </section>

        {/* Live Preview (brand-safe split or legacy image) */}
        <section className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">Live Marketing Preview</h3>
          {form.layout === "split_asym" || form.headline ? (
            <div className="overflow-hidden rounded-xl border border-border/20 shadow-inner">
              <BannerHero
                banner={previewBanner as any}
                showAdBadge
                disableTracking
              />
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-border/30 max-h-64 shadow-soft">
              <img
                src={form.imageUrl || "/fallback.png"}
                alt={form.altText || form.title || "banner"}
                className="w-full h-64 object-cover"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
                }
              />
            </div>
          )}
        </section>

        {/* List */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Banner Preview</th>
                  <th className="px-6 py-4 border-r border-border/20">Title & Destination</th>
                  <th className="px-6 py-4 border-r border-border/20">Placement Location</th>
                  <th className="px-6 py-4 border-r border-border/20">Layout Mode</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Active</th>
                  <th className="px-6 py-4 border-r border-border/20">Scheduled Window</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Priority</th>
                  <th className="px-6 py-4 border-r border-border/20">Analytics Stats</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center bg-secondary/5">
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                      No banners configured for display.
                    </td>
                  </tr>
                ) : (
                  list.map((b) => (
                    <tr key={b._id} className="hover:bg-secondary/5 transition-colors font-medium text-foreground">
                      <td className="px-6 py-4 border-r border-border/20">
                        <img
                          src={b.imageUrl}
                          alt={b.altText || b.title || "banner"}
                          className="w-28 h-12 object-cover rounded border border-border/20 shadow-sm"
                          onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).src =
                              "/fallback.png")
                          }
                        />
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 max-w-[200px] truncate">
                        <div className="font-semibold text-foreground truncate">
                          {b.title || "-"}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {b.linkUrl || "No target URL"}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground uppercase text-[10px]">{b.placement}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground uppercase text-[10px]">{b.layout || "image_full"}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider ${
                          b.active
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}>
                          {b.active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground">
                        <div className="text-[10px] leading-relaxed">
                          {b.startAt ? new Date(b.startAt).toLocaleString() : "-"}{" "}
                          → {b.endAt ? new Date(b.endAt).toLocaleString() : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center font-semibold">{b.priority ?? 0}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground">
                        <div className="text-[10px] leading-relaxed">
                          <span className="font-semibold text-foreground">{b.impressions || 0}</span> views<br />
                          <span className="font-semibold text-foreground">{b.clicks || 0}</span> clicks
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEdit(b)}
                            className="btn px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(b._id!)}
                            className="btn border-rose-500/30 text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AdminLayout>
    </ProtectedRoute>
  );
}
