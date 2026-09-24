import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { jwtDecode } from "jwt-decode";
import type { AppDispatch, RootState } from "../../store";
import type { User } from "../../store/slices/authSlice";
import { logoutAsync } from "../../store/slices/authSlice";
import {
  Bars3Icon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  CurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  EnvelopeIcon,
  HomeIcon,
  MegaphoneIcon,
  PhotoIcon,
  ShoppingCartIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const ADMIN_CATALOG = [
  { href: "/admin", label: "Dashboard", icon: HomeIcon },
  { href: "/admin/analytics", label: "Analytics", icon: ChartBarIcon, perm: "analytics:read" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon, perm: "orders:read" },
  { href: "/admin/products", label: "Products", icon: CubeIcon, perm: "products:read" },
  { href: "/admin/returns", label: "Returns", icon: CurrencyDollarIcon, perm: "returns:read" },
  { href: "/admin/categories", label: "Categories", icon: TagIcon, perm: "products:read" },
  { href: "/admin/users", label: "Users", icon: UsersIcon, perm: "users:read" },
  { href: "/admin/seller-requests", label: "Seller Requests", icon: ClipboardDocumentListIcon, perm: "sellers:read" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketIcon, perm: "coupons:read" },
  { href: "/admin/emails", label: "Email Templates", icon: EnvelopeIcon, perm: "emailTemplates:read" },
  { href: "/admin/media", label: "Media", icon: PhotoIcon, perm: "media:read" },
  { href: "/admin/banners", label: "Banners", icon: PhotoIcon },
  { href: "/admin/sponsored", label: "Sponsored", icon: MegaphoneIcon },
  { href: "/admin/logs", label: "Logs", icon: DocumentMagnifyingGlassIcon, perm: "logs:read" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user) as User | null;
  const [open, setOpen] = useState(false);

  let needsMFA = false;
  if (user?.accessToken && (user.role === "admin" || user.role === "subadmin")) {
    try {
      const decoded = jwtDecode<{ mfa?: boolean }>(user.accessToken);
      needsMFA = !decoded?.mfa;
    } catch {}
  }

  const nav = useMemo(() => {
    if (user?.role === "admin") return ADMIN_CATALOG;
    if (user?.role === "subadmin") {
      const allowed = new Set(user.permissions || []);
      return ADMIN_CATALOG.filter((item) => !item.perm || allowed.has(item.perm));
    }
    return ADMIN_CATALOG.filter((item) => !item.perm);
  }, [user]);

  const isActive = (href: string) =>
    href === "/admin" ? router.pathname === href : router.pathname.startsWith(href);

  const forceLogout = async () => {
    await dispatch(logoutAsync());
    router.replace("/auth/login?next=/admin");
  };

  const NavList = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="space-y-2">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setOpen(false)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
              active
                ? "border-primary/40 bg-primary/12 text-foreground"
                : "border-border bg-secondary text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="page-shell">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Admin Control
          </div>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            Marketplace operations
          </h1>
        </div>
        <button type="button" className="btn md:hidden" onClick={() => setOpen(true)}>
          <Bars3Icon className="h-5 w-5" />
          Menu
        </button>
      </div>

      {needsMFA ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="surface-card w-full max-w-lg p-8 text-center">
            <div className="mb-3 inline-flex rounded-full border border-destructive/30 bg-destructive/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Security Required
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              Two-factor authentication is required
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Complete sign-in verification before using the admin workspace.
            </p>
            <button type="button" className="btn-primary mt-6 w-full" onClick={forceLogout}>
              Logout and re-authenticate
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="surface-card sticky top-28 p-4">
            <div className="mb-4 border-b border-border pb-4">
              <div className="text-sm font-semibold text-foreground">Workspace</div>
              <div className="text-xs text-muted-foreground">Admin navigation</div>
            </div>
            <NavList />
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute left-0 top-0 h-full w-full max-w-sm border-r border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Admin Menu</div>
                <div className="text-xs text-muted-foreground">Navigate the console</div>
              </div>
              <button type="button" className="btn h-10 w-10 px-0" onClick={() => setOpen(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <NavList mobile />
          </div>
        </div>
      ) : null}
    </div>
  );
}
