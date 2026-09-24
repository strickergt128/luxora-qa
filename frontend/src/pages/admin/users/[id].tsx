import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { currency, shortDate } from "../../../utils/format";
import { toast } from "react-hot-toast";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

function AdminUserDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [permCatalog, setPermCatalog] = useState<string[]>([]); 
  const [sellerPermCatalog, setSellerPermCatalog] = useState<string[]>([]); 
  const [permInfo, setPermInfo] = useState<{
    role: Role;
    permissions: string[];
    assistantFor?: string | null;
    sellerApproved?: boolean;
  }>({
    role: "user",
    permissions: [],
    assistantFor: null,
    sellerApproved: false,
  });
  const [savingPerms, setSavingPerms] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [sellerList, setSellerList] = useState<
    { _id: string; name: string; email: string }[]
  >([]);
  const [linking, setLinking] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>("");

  const fetchAll = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [details, pcat, pinfo, users] = await Promise.all([
        api.get(`/admin/users/${id}/details`),
        api.get(`/admin/permissions/catalog`),
        api.get(`/admin/users/${id}/permissions`),
        api.get(`/admin/users`), 
      ]);
      setData(details.data);

      setPermCatalog(pcat.data?.permissions || []);
      setSellerPermCatalog(pcat.data?.sellerAssistant || []);

      setPermInfo(pinfo.data);
      setSelectedPerms(pinfo.data?.permissions || []);

      const sellers = (users.data || []).filter(
        (u: any) => u.role === "seller" && u?.seller?.approved
      );
      setSellerList(sellers);
      setSelectedSeller(pinfo.data.assistantFor || "");
    } catch (e) {
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { user, orders, summary } = data || {
    user: {},
    orders: [],
    summary: {},
  };

  const changeRole = async (newRole: Role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated successfully");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update role");
    }
  };

  const savePermissions = async () => {
    try {
      setSavingPerms(true);
      await api.patch(`/admin/users/${id}/permissions`, {
        permissions: selectedPerms,
      });
      toast.success("Permissions updated successfully");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update permissions");
    } finally {
      setSavingPerms(false);
    }
  };

  const updateAssistantLink = async () => {
    try {
      setLinking(true);
      await api.patch(`/admin/users/${id}/assistant`, {
        sellerId: selectedSeller || null,
      });
      toast.success(selectedSeller ? "Assistant linked successfully" : "Assistant unlinked successfully");
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to update assistant link"
      );
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute roles={["admin"]}>
        <AdminLayout>
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
            <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading details...</p>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-5 mb-8">
          <div>
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">User Profile</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Review and configure role-based access, linked metadata details, and user order logs.
            </p>
          </div>
          <a
            href="/admin/users"
            className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            Back to Users
          </a>
        </div>

        {/* Profile card */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Full Name</div>
              <div className="text-foreground font-semibold text-base break-words">{user.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email Address</div>
              <div className="text-foreground font-semibold text-base break-words">{user.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">User Role</div>
              <select
                value={permInfo.role}
                aria-label="User role selector"
                onChange={(e) => changeRole(e.target.value as Role)}
                className="mt-1 bg-card/60 border border-border/80 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
              >
                <option value="user">User</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
                <option value="subadmin">Sub-admin</option>
                <option value="seller_assistant">Seller Assistant</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">User Status</div>
              <span className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] mt-1 inline-block
                ${
                  user.status === "active"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                }
              `}>
                {user.status}
              </span>
            </div>
          </div>
        </section>

        {/* Access management */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
            Access Control Settings
          </h3>

          {/* Sub-admin permissions */}
          {permInfo.role === "subadmin" && (
            <div className="space-y-6">
              <div className="text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl leading-relaxed">
                Assign permissions for this sub-admin. Full Admins always bypass permission restrictions.
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {permCatalog.map((p) => {
                  const checked = selectedPerms.includes(p);
                  return (
                    <label
                      key={p}
                      className="flex items-center gap-3 text-xs text-foreground cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="w-5 h-5 border border-border rounded-md text-primary focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPerms((arr) =>
                              Array.from(new Set([...arr, p]))
                            );
                          } else {
                            setSelectedPerms((arr) =>
                              arr.filter((x) => x !== p)
                            );
                          }
                        }}
                      />
                      <span className="font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">{p}</span>
                    </label>
                  );
                })}
              </div>
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="btn-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                {savingPerms ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          )}

          {/* Seller assistant link + permissions */}
          {permInfo.role === "seller_assistant" && (
            <div className="space-y-8 pt-2">
              <div className="space-y-4">
                <div className="text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl leading-relaxed">
                  Link this assistant to an approved seller to grant access to that seller's data.
                </div>
                <div className="grid sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Linked Seller Merchant
                    </label>
                    <select
                      value={selectedSeller}
                      aria-label="Linked seller merchant selector"
                      onChange={(e) => setSelectedSeller(e.target.value)}
                      className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                    >
                      <option value="">— None —</option>
                      {sellerList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} · {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      onClick={updateAssistantLink}
                      disabled={linking}
                      className="btn-primary w-full py-2.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                    >
                      {linking ? "Saving..." : "Save Merchant Link"}
                    </button>
                  </div>
                </div>
                {permInfo.assistantFor && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-foreground bg-primary/10 border border-primary/20 p-4 rounded-xl">
                    Currently linked to seller ID:{" "}
                    <span className="font-bold text-primary">{permInfo.assistantFor}</span>
                  </div>
                )}
              </div>

              {/* Seller assistant granular permissions */}
              <div className="space-y-6 pt-6 border-t border-border/20">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Assign assistant specific permissions
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sellerPermCatalog.map((p) => {
                    const checked = selectedPerms.includes(p);
                    return (
                      <label
                        key={p}
                        className="flex items-center gap-3 text-xs text-foreground cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="w-5 h-5 border border-border rounded-md text-primary focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPerms((arr) =>
                                Array.from(new Set([...arr, p]))
                              );
                            } else {
                              setSelectedPerms((arr) =>
                                arr.filter((x) => x !== p)
                              );
                            }
                          }}
                        />
                        <span className="font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">{p}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="btn-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  {savingPerms ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </div>
          )}

          {/* Seller-only notice */}
          {permInfo.role === "seller" && (
            <div className="text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl leading-relaxed mt-2">
              Seller merchant accounts receive restricted workspace capabilities upon validation of credentials.
            </div>
          )}

          {/* User notice */}
          {permInfo.role === "user" && (
            <div className="text-xs font-semibold text-muted-foreground leading-relaxed mt-2">
              Standard consumer account with purchase capabilities. No administrative controls.
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">Customer Statistics</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-secondary/10 border border-border/30 rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Orders</div>
              <div className="text-3xl font-semibold text-foreground mt-1">{summary?.ordersCount ?? 0}</div>
            </div>
            <div className="bg-secondary/10 border border-border/30 rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Purchases Spent</div>
              <div className="text-3xl font-semibold text-primary mt-1">
                {currency(summary?.totalSpent ?? 0)}
              </div>
            </div>
            <div className="bg-secondary/10 border border-border/30 rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Last Order Registered</div>
              <div className="text-lg font-semibold text-foreground mt-2.5">
                {summary?.lastOrderAt ? shortDate(summary.lastOrderAt) : "—"}
              </div>
            </div>
          </div>
        </section>

        {/* Orders */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">Transaction History</h3>
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/30">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Order ID</th>
                  <th className="px-6 py-4 border-r border-border/20">Date</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {(orders || []).map((o: any) => (
                  <tr
                    key={o._id}
                    className="hover:bg-secondary/5 transition-colors"
                  >
                    <td className="px-6 py-4 border-r border-border/20 font-bold text-primary">
                      #{o._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 border-r border-border/20 text-muted-foreground font-semibold">{shortDate(o.createdAt)}</td>
                    <td className="px-6 py-4 border-r border-border/20 text-center">
                      <span className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] ${
                        o.status === "delivered" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                        o.status === "cancelled" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : 
                        "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-foreground font-semibold">{currency(o.totalAmount)}</td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5">
                      No registered transaction records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminUserDetailsPage), {
  ssr: false,
});
