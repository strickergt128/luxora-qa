import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { toast } from "react-hot-toast";

function AdminSellerRequestDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [app, setApp] = useState<any>(null);

  const fetchOne = async () => {
    const { data } = await api.get(`/admin/seller-requests/${id}/details`);
    setApp(data);
  };

  useEffect(() => {
    if (id) fetchOne();
  }, [id]);

  const decide = async (action: "approve" | "reject") => {
    try {
      await api.patch(`/admin/seller-requests/${id}`, { action });
      toast.success(`Request ${action}d successfully`);
      router.push("/admin/seller-requests");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed");
    }
  };

  if (!app) {
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

  const { user, sellerApplication } = app;

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
            Review Seller Application
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review credentials, business detail forms, tax documents, and applicant status.
          </p>
        </div>

        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
            Applicant Information
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Full Name</div>
              <div className="text-foreground font-semibold text-base">{user.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email Address</div>
              <div className="text-foreground font-semibold text-base">{user.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Application Status</div>
              <span className={`px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wider text-[10px] mt-1 inline-block
                ${
                  user.sellerRequest === "approved"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : user.sellerRequest === "rejected"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }
              `}>
                {user.sellerRequest}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
            Business Details
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "businessName",
              "legalName",
              "phone",
              "website",
              "gst",
              "address",
              "message",
            ].map((k) => (
              <div key={k} className="bg-secondary/10 border border-border/30 rounded-lg p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                <div className="text-foreground font-semibold text-sm break-words">
                  {sellerApplication?.[k] || "—"}
                </div>
              </div>
            ))}
          </div>

          {sellerApplication?.documents?.length ? (
            <div className="mt-8 pt-6 border-t border-border/20">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Verification Documents</h4>
              <ul className="grid gap-3">
                {sellerApplication.documents.map((d: any, i: number) => (
                  <li key={i}>
                    <a
                      className="block p-4 border border-border/35 bg-card/40 rounded-xl text-primary font-semibold text-xs hover:border-primary/50 transition-all break-words"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.name || d.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => decide("approve")}
            className="btn-primary py-3 px-8 text-xs font-semibold uppercase tracking-wider"
          >
            Approve Merchant
          </button>
          <button
            onClick={() => decide("reject")}
            className="btn py-3 px-8 text-xs font-semibold uppercase tracking-wider text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25"
          >
            Reject Application
          </button>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminSellerRequestDetailPage), {
  ssr: false,
});
