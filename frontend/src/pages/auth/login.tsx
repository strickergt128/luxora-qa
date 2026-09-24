import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import {
  login,
  loginSuccess,
  clearMfa,
  setMfa,
  verifyAdmin2FA,
  enrollInit2FA,
  enrollVerify2FA,
} from "../../store/slices/authSlice";
import type { AppDispatch, RootState } from "../../store";
import api from "../../utils/api";
import { EyeIcon, EyeSlashIcon, XMarkIcon } from "@heroicons/react/24/outline";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});
const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, loading, error, mfa } = useSelector((s: RootState) => s.auth);

  const [otp, setOtp] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [submittingMFA, setSubmittingMFA] = useState(false);
  const [enrollInfo, setEnrollInfo] = useState<{
    secretBase32: string;
    otpauthUrl: string;
    issuer: string;
    accountName: string;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (siteKey && !captchaToken) {
      setCaptchaError("Please complete the CAPTCHA");
      return;
    }
    setCaptchaError(null);

    const res: any = await dispatch(
      login({ email, password, captchaToken: captchaToken || undefined })
    );

    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);

    if (login.fulfilled.match(res)) {
      const next = (router.query.next as string) || "/";
      router.replace(next);
      return;
    }

    const raw = res?.payload as any;
    const flat = raw?.mfa || raw;
    if ((flat?.twoFARequired || flat?.twoFAEnrollRequired) && flat?.challenge) {
      dispatch(
        setMfa({
          mode: flat.twoFARequired ? "verify" : "enroll",
          challenge: flat.challenge || "",
        })
      );
    }
  };

  useEffect(() => {
    if (mfa.mode === "enroll" && mfa.challenge) {
      (async () => {
        const res: any = await dispatch(
          enrollInit2FA({ challenge: mfa.challenge || "" })
        );
        if (enrollInit2FA.fulfilled.match(res)) {
          setEnrollInfo({
            secretBase32: res.payload.secretBase32,
            otpauthUrl: res.payload.otpauthUrl,
            issuer: res.payload.issuer,
            accountName: res.payload.accountName,
          });
          dispatch(
            setMfa({ mode: "enroll-verify", challenge: res.payload.challenge })
          );
        } else {
          setMfaError(res?.payload || "Failed to start 2FA enrollment");
        }
      })();
    }
  }, [mfa.mode, mfa.challenge, dispatch]);

  useEffect(() => {
    if (user) {
      const next = (router.query.next as string) || "/";
      router.replace(next);
    }
  }, [user, router]);

  const verifyMFA = async () => {
    if (!mfa.challenge || !otp) return;
    setSubmittingMFA(true);
    setMfaError(null);
    try {
      const res: any = await dispatch(
        verifyAdmin2FA({ challenge: mfa.challenge, code: otp })
      );
      if (verifyAdmin2FA.fulfilled.match(res)) {
        dispatch(clearMfa());
        const next = (router.query.next as string) || "/admin";
        router.replace(next);
      } else {
        setMfaError(res?.payload || "Invalid code");
      }
    } finally {
      setSubmittingMFA(false);
    }
  };

  const enrollVerifyMFA = async () => {
    if (!mfa.challenge || !otp) return;
    setSubmittingMFA(true);
    setMfaError(null);
    try {
      const res: any = await dispatch(
        enrollVerify2FA({ challenge: mfa.challenge, code: otp })
      );
      if (enrollVerify2FA.fulfilled.match(res)) {
        dispatch(clearMfa());
        const next = (router.query.next as string) || "/admin";
        router.replace(next);
      } else {
        setMfaError(res?.payload || "Invalid code");
      }
    } finally {
      setSubmittingMFA(false);
    }
  };

  const closeModal = () => {
    dispatch(clearMfa());
    setEnrollInfo(null);
    setOtp("");
    setMfaError(null);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="display-font text-3xl font-bold tracking-[0.12em] uppercase text-foreground mb-8 text-center border-b border-border/40 pb-4">
        Sign in
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card/60 backdrop-blur-md border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/40"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  show ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {show ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Link
            href={`/auth/forgot-password${
              email ? `?email=${encodeURIComponent(email)}` : ""
            }`}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors"
          >
            Forgot password?
          </Link>
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

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50 mt-2"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      {mfa.mode && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-card/95 backdrop-blur-md border border-border/50 shadow-soft p-6 relative rounded-xl">
            <button
              type="button"
              aria-label="Close"
              onClick={closeModal}
              className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/40 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {mfa.mode === "verify" && (
              <>
                <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground">
                  Two‑Factor Auth
                </h2>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1 mb-4">
                  Enter the 6‑digit code.
                </p>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground text-center tracking-[0.5em] text-2xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/30"
                  placeholder="123456"
                  autoFocus
                />
                {mfaError && (
                  <p className="text-sm font-semibold text-rose-500 mt-2">{mfaError}</p>
                )}
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={verifyMFA}
                    disabled={submittingMFA || !otp}
                    className="btn-primary w-full"
                  >
                    {submittingMFA ? "Verifying..." : "Verify and continue"}
                  </button>
                  <button
                    onClick={closeModal}
                    className="btn w-full"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {(mfa.mode === "enroll" || mfa.mode === "enroll-verify") && (
              <>
                <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground">
                  Enable 2FA
                </h2>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1 mb-4">
                  Scan the QR or add manually.
                </p>

                {enrollInfo ? (
                  <>
                    <div className="mt-4 flex justify-center">
                      <div className="p-4 bg-white border border-border/50 rounded-md shadow-card">
                        <QRCode value={enrollInfo.otpauthUrl} size={168} />
                      </div>
                    </div>
                    <div className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-foreground space-y-2 p-4 bg-secondary/60 border border-border/40 rounded-md">
                      <p>
                        <strong>Issuer:</strong> {enrollInfo.issuer}
                      </p>
                      <p className="truncate">
                        <strong>Account:</strong> {enrollInfo.accountName}
                      </p>
                      <p className="truncate" title={enrollInfo.secretBase32}>
                        <strong>Secret:</strong>{" "}
                        <code className="text-primary px-1 border border-primary/20 bg-primary/10 rounded-sm">
                          {enrollInfo.secretBase32}
                        </code>
                      </p>
                      <p className="mt-3">
                        Mobile link:{" "}
                        <a
                          href={enrollInfo.otpauthUrl}
                          className="text-primary hover:underline transition-colors font-semibold break-all"
                        >
                          Add to App
                        </a>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-sm font-semibold text-muted-foreground mt-6 text-center">
                    Preparing...
                  </div>
                )}

                <div className="mt-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
                    Enter code
                  </label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground text-center tracking-[0.5em] text-2xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/30"
                    placeholder="123456"
                  />
                </div>
                {mfaError && (
                  <p className="text-sm font-semibold text-rose-500 mt-2">{mfaError}</p>
                )}
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={enrollVerifyMFA}
                    disabled={submittingMFA || !otp || !enrollInfo}
                    className="btn-primary w-full"
                  >
                    {submittingMFA ? "Enabling..." : "Enable 2FA"}
                  </button>
                  <button
                    onClick={closeModal}
                    className="btn w-full"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mt-6 text-center">
        Don’t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-semibold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors ml-1"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
