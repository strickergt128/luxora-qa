import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { register } from "../../store/slices/authSlice";
import type { AppDispatch } from "../../store";
import { useRouter } from "next/router";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.name.trim()) return "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email";
    if (form.password.length < 6)
      return "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    if (!acceptedPolicies)
      return "Please accept the Terms of Service and Privacy Policy";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setLocalError(v);
      return;
    }

    if (siteKey && !captchaToken) {
      setCaptchaError("Please complete the CAPTCHA");
      return;
    }
    setCaptchaError(null);

    setSubmitting(true);
    const { name, email, password } = form;
    const res = await dispatch(
      register({
        name,
        email,
        password,
        captchaToken: captchaToken || undefined,
      })
    );
    setSubmitting(false);

    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);

    if (register.fulfilled.match(res)) {
      router.push("/");
    } else {
      setLocalError((res as any)?.payload || "Registration failed");
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-8 text-center border-b border-border/40 pb-4">
        Register
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Name</label>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
              required
            />
            <button
              type="button"
              aria-label={showPwd ? "Hide password" : "Show password"}
              aria-pressed={showPwd}
              onClick={() => setShowPwd((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  showPwd ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {showPwd ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">At least 6 characters.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
              required
              aria-invalid={
                form.confirmPassword.length > 0 &&
                form.password !== form.confirmPassword
              }
            />
            <button
              type="button"
              aria-label={
                showConfirm ? "Hide confirm password" : "Show confirm password"
              }
              aria-pressed={showConfirm}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  showConfirm ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {showConfirm ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
          {form.confirmPassword.length > 0 &&
            form.password !== form.confirmPassword && (
              <p className="text-xs text-rose-500 mt-1">
                Passwords do not match
              </p>
            )}
        </div>

        {siteKey && (
          <div className="pt-1">
            <HCaptcha
              key={captchaKey}
              sitekey={siteKey}
              onVerify={(token: string) => {
                setCaptchaToken(token);
                setCaptchaError(null);
              }}
              onExpire={() => setCaptchaToken(null)}
            />
            {captchaError && (
              <p className="text-sm text-rose-500 mt-2">{captchaError}</p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="accept-policies"
            type="checkbox"
            className="w-4 h-4 border border-border/80 text-primary rounded focus:ring-primary mt-0.5"
            checked={acceptedPolicies}
            onChange={(e) => {
              setAcceptedPolicies(e.target.checked);
              if (e.target.checked) setLocalError(null);
            }}
          />
          <label htmlFor="accept-policies" className="text-xs text-muted-foreground leading-relaxed">
            I agree to the{" "}
            <Link
              href="/policies/terms"
              className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors uppercase tracking-wider"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/policies/privacy"
              className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors uppercase tracking-wider"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        {localError && <p className="text-sm text-rose-500">{localError}</p>}

        <button
          type="submit"
          disabled={submitting || !acceptedPolicies}
          className="btn-primary w-full disabled:opacity-50 mt-2"
        >
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-sm text-muted-foreground mt-6 text-center">
        Already have an account?{" "}
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
