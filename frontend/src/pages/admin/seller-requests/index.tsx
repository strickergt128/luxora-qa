import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { shortDate } from "../../../utils/format";

type Applicant = {
  _id: string;
  name: string;
  email: string;
  sellerRequest: "pending" | "approved" | "rejected";
  sellerApplication?: { businessName?: string; submittedAt?: string };
};

function AdminSellerRequestsPage() {
  const [list, setList] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/seller-requests");
      setList(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Seller Applications</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review applicant profiles, registered business verification documents, and approve store merchant requests.
          </p>
        </div>

        <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl shadow-soft overflow-hidden mt-4 mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/25 border-b border-border/35">
                <tr className="text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <th className="px-6 py-4 border-r border-border/20">Applicant</th>
                  <th className="px-6 py-4 border-r border-border/20">Business</th>
                  <th className="px-6 py-4 border-r border-border/20">Submitted</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center bg-secondary/5" colSpan={4}>
                      <div className="h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground italic bg-secondary/5" colSpan={4}>
                      No pending applications.
                    </td>
                  </tr>
                ) : (
                  list.map((u) => (
                    <tr
                      key={u._id}
                      className="hover:bg-secondary/5 transition-colors"
                    >
                      <td className="px-6 py-4 border-r border-border/20 font-semibold">
                        <div className="text-foreground text-sm">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-foreground font-semibold">
                        {u.sellerApplication?.businessName || "—"}
                      </td>
                      <td className="px-6 py-4 border-r border-border/20 text-muted-foreground font-semibold">
                        {u.sellerApplication?.submittedAt
                          ? shortDate(u.sellerApplication.submittedAt)
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/admin/seller-requests/${u._id}`}
                          className="btn px-4 py-2 text-[10px] font-semibold uppercase tracking-wider w-fit inline-flex"
                        >
                          Review Detail
                        </Link>
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

export default dynamic(() => Promise.resolve(AdminSellerRequestsPage), {
  ssr: false,
});
