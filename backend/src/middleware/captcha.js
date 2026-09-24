import { URLSearchParams } from "url";

// Verify hCaptcha for routes like login/register
// If HCAPTCHA_SECRET is not set, middleware is a no-op (allows dev without keys).
export const verifyHCaptcha = () => async (req, res, next) => {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return next();

  const token =
    req.body?.captchaToken || req.body?.["h-captcha-response"] || "";
  if (!token) {
    return res.status(400).json({ message: "CAPTCHA required" });
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    const ip =
      req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    if (ip) params.append("remoteip", String(ip));

    let fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
      const mod = await import("node-fetch");
      fetchImpl = mod.default;
    }

    const resp = await fetchImpl("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await resp.json();

    if (!data.success) {
      return res
        .status(400)
        .json({ message: "CAPTCHA failed", codes: data["error-codes"] });
    }

    next();
  } catch (err) {
    console.error("hCaptcha verify error:", err);
    return res
      .status(502)
      .json({ message: "CAPTCHA verification failed, try again" });
  }
};
