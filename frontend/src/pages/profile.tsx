import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { fetchMe } from "../store/slices/authSlice";
import { toast } from "react-hot-toast";
import api from "../utils/api";

type Address = {
  _id?: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
};

function ProfilePage() {
  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <ProfileInner />
    </ProtectedRoute>
  );
}

function ProfileInner() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Addresses
  const addresses = (user as any)?.addresses || [];
  const [newAddr, setNewAddr] = useState<Address>({
    label: "",
    line1: "",
    city: "",
    country: "India",
  });

  // Seller request
  const sellerStatus = (user as any)?.sellerRequest || "none";
  const canRequestSeller = useMemo(
    () => sellerStatus === "none" || sellerStatus === "rejected",
    [sellerStatus]
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", { name, email });
      await dispatch(fetchMe());
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const sendResetLink = async () => {
    if (!user?.email) {
      toast.error("No email found on account");
      return;
    }
    setSendingReset(true);
    try {
      await api.post("/auth/forgot-password", { email: user.email });
      toast.success("Password reset link sent to your email");
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.success("If an account exists, a reset link has been sent");
      } else {
        toast.error(err.response?.data?.message || "Failed to send reset link");
      }
    } finally {
      setSendingReset(false);
    }
  };

  const addAddress = async () => {
    if (!newAddr.line1) {
      toast.error("Address line is required");
      return;
    }
    try {
      await api.post("/users/addresses", newAddr);
      await dispatch(fetchMe());
      setNewAddr({ label: "", line1: "", city: "", country: "India" });
      toast.success("Address added");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add address");
    }
  };

  const updateAddress = async (id: string, patch: Partial<Address>) => {
    try {
      await api.put(`/users/addresses/${id}`, patch);
      await dispatch(fetchMe());
      toast.success("Address updated");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update address");
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await api.delete(`/users/addresses/${id}`);
      await dispatch(fetchMe());
      toast.success("Address removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove address");
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await api.patch(`/users/addresses/${id}/default`);
      await dispatch(fetchMe());
      toast.success("Default address set");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to set default");
    }
  };

  const requestSeller = async () => {
    router.push("/seller/apply");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="border-b border-border/40 pb-6 mb-4">
        <h1 className="display-font text-4xl font-semibold tracking-wide text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your personal info, security preferences, and delivery locations.
        </p>
      </div>

      {/* Basic Info */}
      <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-8 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">
          Basic Information
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Name</label>
            <input
              className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="pt-4 border-t border-border/30">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary px-8 py-3 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Security */}
      <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-8 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">Security</h2>
        <p className="text-sm text-muted-foreground">
          Password updates are handled securely by sending a verified link to your registered email address.
        </p>
        <button
          onClick={sendResetLink}
          disabled={sendingReset}
          className="btn-primary px-6 py-3 disabled:opacity-50"
        >
          {sendingReset ? "Sending..." : "Send password reset link"}
        </button>
      </section>

      {/* Addresses */}
      <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-8 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">Addresses</h2>

        {/* Add new */}
        <div className="grid md:grid-cols-3 gap-4">
          <input
            placeholder="Label (e.g., Home)"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.label || ""}
            onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
          />
          <input
            placeholder="Line 1"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.line1 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
          />
          <input
            placeholder="Line 2"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.line2 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
          />
          <input
            placeholder="City"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.city || ""}
            onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
          />
          <input
            placeholder="State"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.state || ""}
            onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
          />
          <input
            placeholder="ZIP"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.zip || ""}
            onChange={(e) => setNewAddr({ ...newAddr, zip: e.target.value })}
          />
          <input
            placeholder="Country"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.country || ""}
            onChange={(e) =>
              setNewAddr({ ...newAddr, country: e.target.value })
            }
          />
          <input
            placeholder="Phone"
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            value={newAddr.phone || ""}
            onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
          />
          <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              className="w-4 h-4 border border-border/80 text-primary rounded focus:ring-primary focus:ring-offset-0"
              checked={!!newAddr.isDefault}
              onChange={(e) =>
                setNewAddr({ ...newAddr, isDefault: e.target.checked })
              }
            />
            Make default address
          </label>
        </div>
        <div className="pt-2">
          <button
            onClick={addAddress}
            className="btn-primary px-6 py-3"
          >
            Add Address
          </button>
        </div>

        {/* List */}
        <div className="space-y-4 mt-8 pt-6 border-t border-border/30">
          {addresses.length === 0 && (
            <p className="text-muted-foreground text-sm">No addresses found.</p>
          )}
          {addresses.map((a: Address) => (
            <div
              key={a._id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 border border-border/40 p-5 rounded-lg shadow-sm hover:border-primary/30 transition-all duration-200"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-foreground text-base">
                    {a.label || "Address"}
                  </p>
                  {a.isDefault && (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 font-semibold uppercase tracking-wider text-emerald-600 px-2 py-0.5 rounded-sm">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.phone && (
                  <p className="text-muted-foreground text-xs">📞 {a.phone}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0">
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a._id!)}
                    className="btn px-4 py-2 text-xs"
                  >
                    Make Default
                  </button>
                )}
                <button
                  onClick={() =>
                    updateAddress(a._id!, {
                      label: (a.label || "") + "",
                    })
                  }
                  className="btn px-4 py-2 text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAddress(a._id!)}
                  className="px-4 py-2 border border-rose-500/30 bg-rose-500/10 text-rose-500 rounded-md hover:bg-rose-500 hover:text-white font-semibold uppercase tracking-wider transition-colors text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seller */}
      <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-8 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">Seller Account</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span className="inline-flex items-center px-3 py-1 border border-border/50 rounded-sm text-xs font-semibold uppercase tracking-wider bg-secondary text-foreground ml-2">
              {sellerStatus}
            </span>
          </p>
          <button
            onClick={requestSeller}
            disabled={!canRequestSeller}
            className="btn-primary px-6 py-2.5 disabled:opacity-50 text-sm"
          >
            {canRequestSeller
              ? "Request Seller Access"
              : "Request Pending/Approved"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ProfilePage), { ssr: false });
