const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
// Strip trailing /api to get the API origin/base
let API_BASE = RAW_BASE.replace(/\/api\/?$/, "");
const ABSOLUTE_BASE = /^https?:\/\//i.test(API_BASE) ? API_BASE : "";

/**
 * Returns a stable, absolute (when possible) or same-origin URL for images.
 * - http(s) URLs are returned as-is.
 * - //cdn paths gain protocol.
 * - uploads without leading slash are normalized.
 * - empty/invalid -> /fallback.png
 */
export function getImageUrl(src?: string | { url?: string }): string {
  let path = typeof src === "string" ? src : src?.url || "";
  if (!path) return "/fallback.png";

  path = String(path).trim();
  if (/^https?:\/\//i.test(path)) return path;

  if (path.startsWith("//")) {
    const proto =
      typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${proto}${path}`;
  }

  // Normalize missing leading slash (e.g., "uploads/xyz.jpg")
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  // Avoid prefixing local static fallback
  if (path === "/fallback.png" || path.startsWith("/_next/")) {
    return path;
  }

  // If we have an absolute API base, prefix it; otherwise keep same-origin
  if (ABSOLUTE_BASE) {
    return `${ABSOLUTE_BASE}${path}`;
  }
  return path;
}
