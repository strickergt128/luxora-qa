import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

type Props = {
  children: ReactNode;
  roles?: Role[]; // if omitted, any authenticated user can access
};

const roleMatches = (userRole: Role, required: Role[]) => {
  if (required.includes(userRole)) return true;
  // Map subadmin -> admin
  if (required.includes("admin") && userRole === "subadmin") return true;
  // Map seller_assistant -> seller
  if (required.includes("seller") && userRole === "seller_assistant")
    return true;
  return false;
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

    if (roles && !roleMatches(user.role as Role, roles)) {
      router.replace("/403");
    }
  }, [mounted, loading, user, roles, router]);

  if (!mounted) return null;
  if (loading) return null;
  if (!user) return null;
  if (roles && !roleMatches(user.role as Role, roles)) return null;

  return <>{children}</>;
}
