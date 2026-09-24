import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";
import api from "../../../utils/api";
import { currency, shortDate } from "../../../utils/format";
import { getImageUrl } from "../../../utils/images";
import { downloadCSV } from "../../../utils/csv";
import { useAuth } from "../../../hooks/useAuth";
import { hasSellerPerm } from "../../../utils/permissions";
import toast from "react-hot-toast";

type MyProduct = {
  _id: string;
  title: string;
  price: number;
  stock: number;
  status: "active" | "blocked";
  createdAt: string;
  images?: Array<string | { url?: string }>;
  brand?: string;
  category?: string;
};

function StatusBadge({ status }: { status: "active" | "blocked" }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return <span className={`px-2 py-0.5 border rounded-sm text-[10px] font-semibold uppercase tracking-wider ${map[status]}`}>{status}</span>;
}

function SellerProductsPage() {
  const { user } = useAuth();
  const canRead = hasSellerPerm(user as any, "seller:products:read");
  const canWrite = hasSellerPerm(user as any, "seller:products:write");
  const [items, setItems] = useState<MyProduct[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [sort, setSort] = useState<"newest" | "priceAsc" | "priceDesc">(
    "newest"
  );
  const [loading, setLoading] = useState(true);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    summary: { rows: number; created: number; updated: number; errors: number };
    errors: Array<{ row: number; sku?: string; title?: string; error: string }>;
  } | null>(null);

  const [showGuide, setShowGuide] = useState(false);

  const fetchMine = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get("/seller/products");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMine();
  }, [canRead]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter(
      (p) => !term || p.title.toLowerCase().includes(term)
    );
    if (status !== "all") list = list.filter((p) => p.status === status);

    if (sort === "newest")
      list = [...list].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
      );
    if (sort === "priceAsc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "priceDesc")
      list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [items, q, status, sort]);

  const remove = async (id: string) => {
    if (!canWrite) {
      toast.error("You don't have permission to delete products");
      return;
    }
    if (!confirm("Are you sure you want to delete this product? This action is permanent.")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted successfully");
      await fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete product");
    }
  };

  const exportCsv = () => {
    downloadCSV(
      "my-products.csv",
      filtered.map((p) => ({
        id: p._id,
        title: p.title,
        brand: p.brand || "",
        category: p.category || "",
        price: p.price,
        stock: p.stock,
        status: p.status,
        createdAt: p.createdAt,
      })),
      {
        id: "ID",
        title: "Title",
        brand: "Brand",
        category: "Category",
        price: "Price",
        stock: "Stock",
        status: "Status",
        createdAt: "Created At",
      }
    );
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/seller/bulk-products/template", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "luxora_seller_products_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to download template");
    }
  };

  const downloadCategoriesCsv = async () => {
    try {
      const { data } = await api.get("/categories");
      const rows = (data || []).map((c: any) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        active: c.active ? "yes" : "no",
      }));
      downloadCSV("categories.csv", rows, {
        id: "ID",
        name: "Name",
        slug: "Slug",
        active: "Active",
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to fetch categories");
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file.");
      return;
    }
    if (zipFile && zipFile.size > 50 * 1024 * 1024) {
      toast.error("ZIP must be 50MB or less.");
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("csv", csvFile);
      if (zipFile) fd.append("media", zipFile);

      const { data } = await api.post("/seller/bulk-products/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success("Import finished");
      fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorsCsv = () => {
    if (!result?.errors?.length) return;
    downloadCSV("bulk-errors.csv", result.errors, {
      row: "Row",
      sku: "SKU",
      title: "Title",
      error: "Error",
    });
  };

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:read"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to view store products.</p>
            </div>
          }
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5 mb-8">
            <div>
              <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
                My Products
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your product catalog, monitor stock availability, and configure metadata.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={exportCsv}
                className="btn py-2.5 px-4 text-xs font-semibold uppercase tracking-wider"
              >
                Export CSV
              </button>
              <PermissionGate scope="seller" perm="seller:products:write">
                <Link
                  href="/seller/products/new"
                  className="btn-primary py-2.5 px-4 text-xs"
                >
                  + Add Product
                </Link>
              </PermissionGate>
            </div>
          </div>

          {/* Bulk Upload Section */}
          <PermissionGate scope="seller" perm="seller:products:write">
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Bulk Inventory Upload (CSV)</h2>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={downloadTemplate}
                    className="btn py-1.5 px-3 text-[10px]"
                  >
                    Download Template
                  </button>
                  <button
                    onClick={downloadCategoriesCsv}
                    className="btn py-1.5 px-3 text-[10px]"
                    title="Use this to find category IDs or slugs"
                  >
                    Categories Reference
                  </button>
                  <button
                    onClick={() => setShowGuide((s) => !s)}
                    className="btn py-1.5 px-3 text-[10px]"
                  >
                    {showGuide ? "Hide Instructions" : "Formatting Guide"}
                  </button>
                </div>
              </div>

              {showGuide && (
                <div className="border border-border/40 rounded-lg bg-secondary/15 p-4 text-xs text-muted-foreground space-y-2.5 leading-relaxed">
                  <div className="font-semibold text-foreground text-[13px]">CSV/Excel Formatting Guidelines</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Required Columns: <strong className="text-foreground">title</strong>,{" "}
                      <strong className="text-foreground">price</strong>, <strong className="text-foreground">stock</strong>, and either{" "}
                      <strong className="text-foreground">category_id</strong> or{" "}
                      <strong className="text-foreground">category_slug</strong>.
                    </li>
                    <li>
                      Optional Columns: description, sku, brand, discountPrice,
                      tags (comma separated), attributes (JSON string), seoTitle, seoDescription,
                      shipWeight, shipLength, shipWidth, shipHeight, images (pipe-separated).
                    </li>
                    <li>
                      Media Attachments: image columns can reference absolute URL addresses, or local file names included in the optional ZIP attachment.
                    </li>
                    <li>
                      Media ZIP constraints: maximum 50MB file size limit.
                    </li>
                  </ul>
                  <div className="pt-2">
                    <div className="font-semibold text-foreground mb-1.5">Example Row Preview:</div>
                    <pre className="overflow-auto bg-card border border-border/40 rounded-lg p-3 text-[11px] font-mono text-foreground leading-normal whitespace-pre">
                      {`title,price,stock,category_id,category_slug,description,sku,brand,discountPrice,tags,images
"Premium Silk Scarf","2999","15","","scarves","100% genuine Mulberry silk scarf","SLK-SCRF-001","Luxora","2499","accessories, luxury","scarf1.jpg|scarf2.jpg"`}
                    </pre>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Product CSV File
                  </label>
                  <input
                    type="file"
                    id="csv-upload"
                    accept=".csv,text/csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border/85 bg-card/50 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    {csvFile ? csvFile.name : "Select CSV file"}
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Select a UTF-8 encoded product sheet.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Image Media ZIP (optional)
                  </label>
                  <input
                    type="file"
                    id="zip-upload"
                    accept=".zip,application/zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="zip-upload"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border/85 bg-card/50 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    {zipFile ? zipFile.name : "Select ZIP archive"}
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Contains referenced images in CSV. Max 50MB.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-5 border-t border-border/20">
                <button
                  onClick={handleImport}
                  disabled={importing || !csvFile}
                  className="btn-primary py-2 px-5 text-xs"
                >
                  {importing ? "Importing Data..." : "Run Import"}
                </button>
                {result?.errors?.length ? (
                  <button
                    onClick={downloadErrorsCsv}
                    className="btn py-2 px-4 text-xs"
                  >
                    Download Error Log
                  </button>
                ) : null}
              </div>

              {result && (
                <div className="text-xs text-muted-foreground bg-secondary/10 p-3.5 rounded-lg border border-border/20 space-y-1">
                  <div className="font-semibold text-foreground">Import Results:</div>
                  <div>
                    Processed Rows: {result.summary.rows} · Created:{" "}
                    {result.summary.created} · Updated: {result.summary.updated}{" "}
                    · Errors encountered: {result.summary.errors}
                  </div>
                  {result.errors?.length > 0 && (
                    <ul className="mt-2 space-y-1 list-disc pl-5">
                      {result.errors.slice(0, 5).map((e, idx) => (
                        <li key={idx} className="text-rose-400 font-mono text-[10px]">
                          Row {e.row}: {e.error}
                          {e.sku ? ` (SKU: ${e.sku})` : ""}
                          {e.title ? ` — ${e.title}` : ""}
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more errors.</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </PermissionGate>

          {/* Search and Filters */}
          <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <input
                placeholder="Search products by title..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/45 flex-1 md:max-w-xs"
              />
              <div className="flex items-center gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary w-[140px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">ACTIVE</option>
                  <option value="blocked">BLOCKED</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary w-[160px]"
                >
                  <option value="newest">NEWEST</option>
                  <option value="priceAsc">PRICE: LOW TO HIGH</option>
                  <option value="priceDesc">PRICE: HIGH TO LOW</option>
                </select>
              </div>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground self-end sm:self-auto shrink-0 px-2">
              {filtered.length} item{filtered.length === 1 ? "" : "s"} found
            </div>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="bg-card/60 border border-border/40 p-8 text-center rounded-xl">
                <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card/60 border border-border/40 p-8 text-center rounded-xl text-xs font-semibold uppercase tracking-wider text-muted-foreground italic">No products found.</div>
            ) : (
              filtered.map((p) => {
                const thumb = getImageUrl(p.images?.[0]);
                return (
                  <div key={p._id} className="bg-card/60 border border-border/40 p-5 rounded-xl shadow-soft flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={thumb}
                        alt={p.title}
                        className="w-16 h-16 border border-border/40 rounded-lg object-cover bg-card"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground text-sm truncate">{p.title}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase truncate mt-0.5">
                          {p.brand ? `${p.brand} · ` : ""}
                          {p.category || ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-3 border-y border-border/20 py-3 text-xs">
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5">Price</div>
                        <div className="font-semibold text-primary">{currency(p.price)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5">Stock</div>
                        <div className="font-semibold text-foreground">{p.stock}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1">Status</div>
                        <div>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5">Created</div>
                        <div className="text-muted-foreground">
                          {shortDate(p.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2 pt-2">
                      <Link
                        href={`/seller/products/${p._id}`}
                        className="btn flex-1 text-center py-2 px-3 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/seller/products/edit/${p._id}`}
                        className="btn flex-1 text-center py-2 px-3 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => remove(p._id)}
                        className="flex-1 text-center py-2 px-3 border border-rose-500/20 bg-rose-500/10 text-rose-400 rounded-md font-semibold uppercase tracking-wider text-[10px] hover:bg-rose-500/25"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                  <th className="px-6 py-4 border-r border-border/20">Product details</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Price</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Stock</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Created Date</th>
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
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const thumb = getImageUrl(p.images?.[0]);
                    return (
                      <tr
                        key={p._id}
                        className="hover:bg-secondary/10 transition-colors"
                      >
                        <td className="px-6 py-4 border-r border-border/20">
                          <div className="flex items-center gap-4">
                            <img
                              src={thumb}
                              alt={p.title}
                              className="w-12 h-12 border border-border/40 rounded-lg object-cover bg-card shrink-0"
                              onError={(e) =>
                                ((e.currentTarget as HTMLImageElement).src =
                                  "/fallback.png")
                              }
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate max-w-[250px]" title={p.title}>
                                {p.title}
                              </div>
                              <div className="text-[10px] text-muted-foreground tracking-wider uppercase truncate mt-0.5">
                                {p.brand ? `${p.brand} · ` : ""}
                                {p.category || ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center font-semibold text-primary text-sm">{currency(p.price)}</td>
                        <td className="px-6 py-4 border-r border-border/20 text-center font-semibold text-foreground text-sm">{p.stock}</td>
                        <td className="px-6 py-4 border-r border-border/20 text-center">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-6 py-4 border-r border-border/20 text-center font-semibold text-muted-foreground">{shortDate(p.createdAt)}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center flex-wrap">
                            <Link
                              href={`/seller/products/${p._id}`}
                              className="btn px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center"
                            >
                              Details
                            </Link>
                            <Link
                              href={`/seller/products/edit/${p._id}`}
                              className="btn px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => remove(p._id)}
                              className="px-3.5 py-1.5 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-md font-semibold uppercase tracking-wider text-[10px] flex items-center"
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
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerProductsPage), {
  ssr: false,
});
