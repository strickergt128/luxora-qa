import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

type Category = { _id: string; name: string; slug: string; active: boolean };

function AdminCategoriesPage() {
  const [list, setList] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [importText, setImportText] = useState("");

  const fetchCats = async () => {
    const { data } = await api.get("/categories");
    setList(data || []);
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const create = async () => {
    try {
      await api.post("/categories", { name });
      setName("");
      fetchCats();
      toast.success("Category created!");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to create");
    }
  };

  const toggleActive = async (c: Category) => {
    await api.patch(`/categories/${c._id}`, { active: !c.active });
    fetchCats();
  };

  const bulkImport = async () => {
    try {
      const items = JSON.parse(importText);
      if (!Array.isArray(items)) throw new Error("Invalid JSON: must be array");
      await api.post("/categories/import", { items });
      setImportText("");
      fetchCats();
      toast.success("Imported categories successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Invalid JSON");
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Categories</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure catalog item categories, slug configurations, and active visibilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">Create New Category</h3>
            <div className="flex gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                placeholder="Category name"
              />
              <button
                onClick={create}
                className="btn-primary px-6 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Add
              </button>
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Example: Electronics, Fashion, Home, Beauty
            </p>
          </section>

          <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">Bulk Import (JSON Array)</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
              placeholder='[{"name":"Electronics"},{"name":"Home"}]'
            />
            <button
              onClick={bulkImport}
              className="btn py-2 px-5 text-xs font-semibold uppercase tracking-wider"
            >
              Import Array
            </button>
          </section>
        </div>

        <section className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft mt-8 overflow-hidden">
          <div className="p-5 border-b border-border/35 bg-secondary/15">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground m-0">All Available Categories</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Name</th>
                  <th className="px-6 py-4 border-r border-border/20">Slug</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Active</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  list.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-secondary/5 transition-colors"
                    >
                      <td className="px-6 py-4 border-r border-border/20 font-semibold text-foreground text-sm">{c.name}</td>
                      <td className="px-6 py-4 border-r border-border/20 font-mono text-muted-foreground">{c.slug}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] ${
                            c.active
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border/40"
                          }`}
                        >
                          {c.active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleActive(c)}
                          className={`btn px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                            c.active ? "text-rose-400 border-rose-500/20 hover:bg-rose-500/10" : ""
                          }`}
                        >
                          {c.active ? "Disable" : "Enable"}
                        </button>
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

export default dynamic(() => Promise.resolve(AdminCategoriesPage), {
  ssr: false,
});
