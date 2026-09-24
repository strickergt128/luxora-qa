import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

const normalizeRole = (r?: string): Role | null => {
  if (!r) return null;
  const key = r.toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "sub_admin" || key === "subadmin") return "subadmin";
  if (key === "seller_assistant" || key === "assistant")
    return "seller_assistant";
  if (key === "admin") return "admin";
  if (key === "seller") return "seller";
  if (key === "user") return "user";
  return null;
};

const roleMatches = (userRoleRaw: string | undefined, required: Role[]) => {
  const userRole = normalizeRole(userRoleRaw);
  if (!userRole) return false;

  if (
    required.includes("admin") &&
    (userRole === "admin" || userRole === "subadmin")
  ) {
    return true;
  }
  if (
    required.includes("seller") &&
    (userRole === "seller" || userRole === "seller_assistant")
  ) {
    return true;
  }
  if (required.includes(userRole)) return true;

  return false;
};

export default function GlobalRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use pathname from window to avoid SSR mismatch
  const path =
    typeof window !== "undefined" ? window.location.pathname : router.pathname;

  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  const isSellerRoute = path === "/seller" || path.startsWith("/seller/");

  // Allowlist: seller onboarding page is public for non-sellers
  const sellerAllow = path === "/seller/apply";
  const isAuthRoute = path.startsWith("/auth/");
  const isErrorRoute = path === "/403";

  useEffect(() => {
    if (!mounted || loading) return;
    if (isAuthRoute || isErrorRoute) return;

    if (isAdminRoute) {
      if (!user) {
        const next = encodeURIComponent(router.asPath || "/admin");
        router.replace(`/auth/login?next=${next}`);
        return;
      }
      if (!roleMatches(user.role as any, ["admin"])) {
        router.replace("/403");
        return;
      }
    } else if (isSellerRoute && !sellerAllow) {
      if (!user) {
        const next = encodeURIComponent(router.asPath || "/seller");
        router.replace(`/auth/login?next=${next}`);
        return;
      }
      if (!roleMatches(user.role as any, ["seller"])) {
        router.replace("/403");
        return;
      }
    }
  }, [
    mounted,
    loading,
    user,
    isAdminRoute,
    isSellerRoute,
    sellerAllow,
    isAuthRoute,
    isErrorRoute,
    router,
  ]);

  if (!mounted) return null;
  if (loading) return null;

  // Don’t render protected children while redirecting
  if (isAdminRoute) {
    if (!user) return null;
    if (!roleMatches(user.role as any, ["admin"])) return null;
  } else if (isSellerRoute && !sellerAllow) {
    if (!user) return null;
    if (!roleMatches(user.role as any, ["seller"])) return null;
  }

  return <>{children}</>;
}
