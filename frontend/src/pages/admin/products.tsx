import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency, shortDate } from "../../utils/format";

type AdminProduct = {
  _id: string;
  title: string;
  price: number;
  stock: number;
  status: "active" | "blocked";
  category?: string;
  owner?: { name: string; email: string };
  createdAt: string;
};

function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdminProduct["status"]>("all");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/products");
      setProducts(data);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const ql = q.toLowerCase();
      const matchesQ =
        !q ||
        p.title.toLowerCase().includes(ql) ||
        p.owner?.email?.toLowerCase().includes(ql);
      const matchesStatus = status === "all" || p.status === status;
      return matchesQ && matchesStatus;
    });
  }, [products, q, status]);

  const toggleStatus = async (id: string, current: AdminProduct["status"]) => {
    try {
      const next = current === "active" ? "blocked" : "active";
      await api.patch(`/admin/products/${id}/status`, { status: next });
      toast.success(`Product ${next}`);
      fetchProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product? This action cannot be undone.")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Catalog Inventory</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Global product inventory management, seller item moderations, and catalog pricing listings.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by title or owner email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              aria-label="Filter status"
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Title</th>
                  <th className="px-6 py-4 border-r border-border/20">Owner</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Price</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Stock</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Created</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center bg-secondary/5" colSpan={7}>
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5" colSpan={7}>
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-secondary/5 transition-colors"
                    >
                      <td className="px-6 py-4 border-r border-border/20 font-semibold">
                        <Link
                          href={`/products/${p._id}`}
                          className="text-primary hover:underline hover:text-foreground transition-colors max-w-[200px] truncate block"
                          title={p.title}
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 max-w-[200px] truncate" title={p.owner?.email || "—"}>
                        <div className="font-semibold text-foreground">{p.owner?.name || "—"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {p.owner?.email || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center text-foreground font-semibold text-sm whitespace-nowrap">{currency(p.price)}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <span className="font-bold text-foreground">{p.stock}</span>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] ${
                            p.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center text-muted-foreground font-semibold whitespace-nowrap">{shortDate(p.createdAt)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center items-center flex-wrap">
                          <button
                            onClick={() => toggleStatus(p._id, p.status)}
                            className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider min-w-[80px]"
                          >
                            {p.status === "active" ? "Block" : "Unblock"}
                          </button>
                          <button
                            onClick={() => deleteProduct(p._id)}
                            className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25"
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
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminProductsPage), {
  ssr: false,
});
