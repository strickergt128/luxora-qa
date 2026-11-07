import { asText } from "./sanitize.js";

/** IP del cliente: primer valor de X-Forwarded-For (detrás de proxies) o la IP de la conexión. */
export const clientIp = (req) =>
  (Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"] || req.ip || ""
  )
    .toString()
    .split(",")[0]
    .trim() || "unknown";

/**
 * Identificador de sesión para deduplicar eventos de analítica: cookie sid o rt, o en su
 * defecto IP + agente de usuario. Siempre se devuelve como texto (evita inyección NoSQL).
 */
export const sessionOf = (req) => {
  const ua = (req.get("user-agent") || "").slice(0, 128);
  return asText(
    req.cookies?.sid || req.cookies?.rt || `${clientIp(req)}|${ua.slice(0, 32)}`
  );
};

/** Fecha en formato AAAA-MM-DD (UTC). */
export const ymdUTC = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
