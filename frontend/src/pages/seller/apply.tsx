import dynamic from "next/dynamic";
import React, { useState, memo } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import SellerLayout from "../../components/layout/SellerLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

type TextFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
};
const TextField = memo(function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: TextFieldProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
      autoComplete="off"
    />
  );
});

function SellerApplyPage() {
  const [form, setForm] = useState({
    businessName: "",
    legalName: "",
    phone: "",
    website: "",
    gst: "",
    address: "",
    message: "",
    documents: [] as { url: string; name?: string }[],
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadDoc = async () => {
    if (!docFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", docFile);
    try {
      const { data } = await api.post("/users/apply/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({
        ...f,
        documents: [...f.documents, { url: data.url, name: docFile.name }],
      }));
      setDocFile(null);
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post("/users/seller-request", form);
      toast.success("Application submitted successfully");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <SellerLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
            Apply to Sell on Luxora
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Provide your business registration details and documents. Our merchant team will review.
          </p>
        </div>

        <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <TextField
              placeholder="Business Name"
              value={form.businessName}
              onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
            />
            <TextField
              placeholder="Legal Entity Name"
              value={form.legalName}
              onChange={(v) => setForm((f) => ({ ...f, legalName: v }))}
            />
            <TextField
              placeholder="Contact Phone Number"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <TextField
              placeholder="Business Website (optional)"
              value={form.website}
              onChange={(v) => setForm((f) => ({ ...f, website: v }))}
            />
            <TextField
              placeholder="GSTIN / Business Registration ID"
              value={form.gst}
              onChange={(v) => setForm((f) => ({ ...f, gst: v }))}
            />
            <TextField
              placeholder="Registered Business Address"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            />
          </div>

          <textarea
            placeholder="Tell us about the catalog, brand range, or premium products you plan to list on Luxora..."
            value={form.message}
            onChange={(e) =>
              setForm((f) => ({ ...f, message: e.target.value }))
            }
            className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
            rows={4}
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="file"
              id="media-upload"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="media-upload"
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
              {docFile ? docFile.name : "Choose business document"}
            </label>
            <button
              onClick={uploadDoc}
              disabled={!docFile || uploading}
              className="btn-primary py-2 px-5 text-xs"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>

          {form.documents.length > 0 && (
            <ul className="text-xs space-y-1.5 list-disc pl-5 text-muted-foreground">
              {form.documents.map((d, i) => (
                <li key={i}>
                  <span className="font-semibold text-foreground">{d.name || "Document"}</span> —{" "}
                  <a
                    className="text-primary hover:underline font-semibold"
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview Document
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-4 border-t border-border/20 justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary py-3 px-8 text-xs w-full sm:w-auto"
            >
              {submitting ? "Submitting Application..." : "Submit Application"}
            </button>
          </div>
        </div>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerApplyPage), { ssr: false });
