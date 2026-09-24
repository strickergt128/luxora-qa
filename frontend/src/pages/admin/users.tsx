import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import AdminLayout from "../../components/layout/AdminLayout";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: "user" | "seller" | "admin" | "subadmin" | "seller_assistant";
  status: "active" | "blocked";
  sellerRequest?: "none" | "pending" | "approved" | "rejected";
  seller?: { approved?: boolean };
  createdAt?: string;
};

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | AdminUser["role"]>("all");
  const [status, setStatus] = useState<"all" | AdminUser["status"]>("all");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const ql = q.toLowerCase();
      const matchesQ =
        !q ||
        u.name.toLowerCase().includes(ql) ||
        u.email.toLowerCase().includes(ql);
      const matchesRole = role === "all" || u.role === role;
      const matchesStatus = status === "all" || u.status === status;
      return matchesQ && matchesRole && matchesStatus;
    });
  }, [users, q, role, status]);

  const changeRole = async (id: string, newRole: AdminUser["role"]) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated successfully");
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update role");
    }
  };

  const toggleStatus = async (id: string, newStatus: AdminUser["status"]) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
      toast.success(`User status updated to ${newStatus}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const handleSellerRequest = async (
    id: string,
    action: "approve" | "reject"
  ) => {
    try {
      await api.patch(`/admin/seller-requests/${id}`, { action });
      toast.success(`Seller request ${action}d successfully`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Manage Users</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure system roles, permissions, block status, and seller requests.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 w-full md:w-80"
          />
          <div className="flex gap-3">
            <select
              value={role}
              aria-label="Filter role"
              onChange={(e) => setRole(e.target.value as AdminUser["role"])}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="seller">Seller</option>
              <option value="admin">Admin</option>
              <option value="subadmin">Sub-admin</option>
              <option value="seller_assistant">Seller Assistant</option>
            </select>
            <select
              value={status}
              aria-label="Filter status"
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200"
            >
              <option value="all">All status</option>
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
                  <th className="px-6 py-4 border-r border-border/20">Name</th>
                  <th className="px-6 py-4 border-r border-border/20">Email</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Role</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Status</th>
                  <th className="px-6 py-4 border-r border-border/20 text-center">Seller Status</th>
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
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr
                      key={u._id}
                      className="hover:bg-secondary/5 transition-colors"
                    >
                      <td className="px-6 py-4 border-r border-border/20 font-semibold text-foreground text-sm">{u.name}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground font-semibold">{u.email}</td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <select
                          value={u.role}
                          aria-label="Update role"
                          onChange={(e) =>
                            changeRole(u._id, e.target.value as AdminUser["role"])
                          }
                          className="bg-card/60 border border-border/80 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary text-center"
                        >
                          <option value="user">User</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                          <option value="subadmin">Sub-admin</option>
                          <option value="seller_assistant">Seller Asst.</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] ${
                            u.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-center">
                        {u.sellerRequest === "pending" ? (
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider text-[10px]">
                            Pending
                          </span>
                        ) : u.role === "seller" && u.seller?.approved ? (
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider text-[10px]">
                            Approved
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                            {u.sellerRequest || "none"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center items-center flex-wrap">
                          <a
                            href={`/admin/users/${u._id}`}
                            className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider inline-flex"
                          >
                            Details
                          </a>

                          {u.status === "active" ? (
                            <button
                              onClick={() => toggleStatus(u._id, "blocked")}
                              className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25"
                            >
                              Block
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleStatus(u._id, "active")}
                              className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/25"
                            >
                              Unblock
                            </button>
                          )}

                          {u.sellerRequest === "pending" && (
                            <>
                              <a
                                href={`/admin/seller-requests/${u._id}`}
                                className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider inline-flex"
                              >
                                Review
                              </a>
                              <button
                                onClick={() =>
                                  handleSellerRequest(u._id, "approve")
                                }
                                className="btn-primary px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleSellerRequest(u._id, "reject")
                                }
                                className="btn px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25"
                              >
                                Reject
                              </button>
                            </>
                          )}
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

export default dynamic(() => Promise.resolve(AdminUsersPage), { ssr: false });
