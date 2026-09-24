import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  ChartBarIcon,
  CubeIcon,
  HomeIcon,
  ShoppingCartIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";

type NavItem = { href: string; label: string; icon: any; perm?: string };

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const catalog: NavItem[] = [
    { href: "/seller", label: "Dashboard", icon: HomeIcon },
    { href: "/seller/analytics", label: "Analytics", icon: ChartBarIcon, perm: "seller:analytics:read" },
    { href: "/seller/orders", label: "Orders", icon: ShoppingCartIcon, perm: "seller:orders:read" },
    { href: "/seller/products", label: "Products", icon: CubeIcon, perm: "seller:products:read" },
  ];

  const nav = useMemo(
    () => catalog.filter((item) => !item.perm || hasSellerPerm(user as any, item.perm)),
    [user]
  );

  const isActive = (href: string) =>
    router.pathname === href || (href !== "/seller" && router.pathname.startsWith(href));

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

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
            Seller Workspace
          </div>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            Catalog, orders, and insights
          </h1>
        </div>
        <button type="button" className="btn lg:hidden" onClick={() => setOpen(true)}>
          <Bars3Icon className="h-5 w-5" />
          Menu
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="surface-card sticky top-28 p-4">
            <div className="mb-4 border-b border-border pb-4">
              <div className="text-sm font-semibold text-foreground">Seller Menu</div>
              <div className="text-xs text-muted-foreground">Manage your business</div>
            </div>
            <NavList />
          </div>
        </aside>

        <section className="min-w-0 space-y-6">{children}</section>
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
                <div className="text-sm font-semibold text-foreground">Seller Menu</div>
                <div className="text-xs text-muted-foreground">Navigate your workspace</div>
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
