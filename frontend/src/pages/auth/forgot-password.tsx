import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../../utils/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = (router.query.email as string) || "";
    if (q) setEmail(q);
  }, [router.query.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setDone(true);
      } else {
        setError(err.response?.data?.message || "Failed to send reset link");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-4 border-b border-border/40 pb-4">
          Check email
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-4">
          If an account exists for <strong className="text-foreground">{email}</strong>, a password reset
          link has been sent.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Didn’t get it? Check spam or try again later.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="btn-primary px-6 py-3"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-8 text-center border-b border-border/40 pb-4">
        Reset Password
      </h1>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Email Address</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            placeholder="you@example.com"
            required
          />
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-50 mt-2"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground mt-6 text-center">
        Remembered password?{" "}
        <Link
          href="/auth/login"
          className="font-semibold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors ml-1"
        >
          Login
        </Link>
      </p>
    </div>
  );
}
