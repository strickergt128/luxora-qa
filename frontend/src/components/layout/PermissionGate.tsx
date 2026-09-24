import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

// Normalize any role string (case, hyphen/underscore variants)
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

  // Admin group (admin or subadmin)
  if (
    required.includes("admin") &&
    (userRole === "admin" || userRole === "subadmin")
  ) {
    return true;
  }
  // Seller group (seller or seller_assistant)
  if (
    required.includes("seller") &&
    (userRole === "seller" || userRole === "seller_assistant")
  ) {
    return true;
  }
  // Direct match
  if (required.includes(userRole)) return true;

  return false;
};

type Props = {
  children: ReactNode;
  roles?: Role[]; // if omitted, any authenticated user can access
  perm?: string; // optional, so existing code doesn’t break
  fallback?: ReactNode;
  scope?: string; // optional, so existing code doesn’t break
};

export default function ProtectedRoute({ children, roles }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || loading) return;

    if (!user) {
      const next = encodeURIComponent(router.asPath || "/");
      router.replace(`/auth/login?next=${next}`);
      return;
    }

    if (roles && !roleMatches(user.role as any, roles)) {
      router.replace("/403");
    }
  }, [mounted, loading, user, roles, router]);

  if (!mounted) return null;
  if (loading) return null;
  if (!user) return null;
  if (roles && !roleMatches(user.role as any, roles)) return null;

  return <>{children}</>;
}
