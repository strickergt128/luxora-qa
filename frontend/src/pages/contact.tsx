import { useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { toast } from "react-hot-toast";
import api from "../utils/api";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});

export default function ContactPage() {
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    orderId: "",
    message: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || []);
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const filtered = f.filter((x) => allowed.includes(x.type)).slice(0, 3);
    const tooBig = filtered.some((x) => x.size > 5 * 1024 * 1024);
    if (tooBig) {
      toast.error("Each image must be under 5MB.");
      return;
    }
    if (f.length !== filtered.length) {
      toast("Some files were skipped (only images: JPG/PNG/WebP).", {
        icon: "ℹ️",
      });
    }
    setFiles(filtered);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const canSubmit =
    form.name.trim() &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.subject.trim() &&
    form.message.trim() &&
    (!siteKey || !!captchaToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("email", form.email.trim());
      fd.append("subject", form.subject.trim());
      if (form.orderId.trim()) fd.append("orderId", form.orderId.trim());
      fd.append("message", form.message.trim());
      if (captchaToken) fd.append("captchaToken", captchaToken);
      files.forEach((f) => fd.append("attachments", f, f.name));

      await api.post("/contact", fd);
      toast.success("Message sent. Support will reply within 1 business day.");
      setForm({ name: "", email: "", subject: "", orderId: "", message: "" });
      setFiles([]);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "We could not send your message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Contact Us · Luxora</title>
        <meta name="description" content="Get in touch with Luxora support." />
      </Head>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="surface-card p-8 md:p-12 text-center md:text-left">
          <div className="mb-8 border-b border-border pb-6 text-center md:text-left">
            <h1 className="text-4xl font-bold text-foreground">Contact support</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Tell us what happened. Include your order ID for faster help.
            </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Name</label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">Subject</label>
            <input
              name="subject"
              type="text"
              value={form.subject}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Order ID (optional)
            </label>
            <input
              name="orderId"
              type="text"
              value={form.orderId}
              onChange={handleChange}
              className="input"
              placeholder="Paste your order ID"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={6}
              className="input resize-y"
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Add product names, delivery issues, or payment details that help us solve it.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <label className="mb-4 block text-sm font-semibold text-foreground">
              Attachments (optional)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <input
                type="file"
                id="media-upload"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onFileChange}
                className="sr-only"
              />
              <label
                htmlFor="media-upload"
                className="btn-secondary inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
              >
                <svg
                  className="w-4 h-4 text-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                  <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                </svg>
                Choose files
              </label>
              <p className="text-xs text-muted-foreground">
                Up to 3 images, max 5MB each (JPG, PNG, WebP).
              </p>
            </div>
            
            {files.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-foreground">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {siteKey && (
            <div>
              <HCaptcha
                key={captchaKey}
                sitekey={siteKey}
                onVerify={(token: string) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
              />
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="btn-primary w-full px-8 py-3 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Sending..." : "Send message"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
