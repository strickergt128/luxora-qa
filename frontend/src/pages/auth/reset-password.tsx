import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../../utils/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = (router.query.token as string) || "";
    if (t) setToken(t);
  }, [router.query.token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-4 border-b border-border/40 pb-4">
          Reset successful
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can now sign in with your new password.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="btn-primary px-6 py-3"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-8 text-center border-b border-border/40 pb-4">
        New Password
      </h1>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            New password
          </label>
          <input
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            placeholder="Repeat password"
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            required
          />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-xs text-rose-500 mt-1">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !token}
          className="btn-primary w-full disabled:opacity-50 mt-2"
        >
          {submitting ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground mt-6 text-center">
        Don’t have a token?{" "}
        <Link
          href="/auth/forgot-password"
          className="font-semibold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors ml-1"
        >
          Request new reset link
        </Link>
      </p>
    </div>
  );
}
