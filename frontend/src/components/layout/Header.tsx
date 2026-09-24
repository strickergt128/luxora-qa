import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { AppDispatch, RootState } from "../../store";
import { logoutAsync } from "../../store/slices/authSlice";
import SearchBar from "../SearchBar";
import ThemeToggle from "./ThemeToggle";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";
type NavLink = { href: string; label: string; badge?: number };

const departments = ["Fashion", "Electronics", "Home", "Beauty", "Deals", "New arrivals"];

const getDepartmentQuery = (department: string) =>
  department === "Deals"
    ? { search: "discount" }
    : department === "New arrivals"
      ? { sort: "newest" }
      : { category: department };

export default function Header() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const cartItems = useSelector((s: RootState) => s.cart.items ?? []);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const close = () => {
      setOpen(false);
      setMobileSearchOpen(false);
    };
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  useEffect(() => {
    if (!open && !mobileSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mobileSearchOpen]);

  useEffect(() => {
    if (!open && !mobileSearchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mobileSearchOpen]);

  const canSeeAdmin = (role?: Role) => role === "admin" || role === "subadmin";
  const canSeeSeller = (role?: Role) =>
    role === "seller" || role === "seller_assistant";

  const navLinks = useMemo<NavLink[]>(() => {
    const base: NavLink[] = [
      { href: "/products", label: "Shop" },
      { href: "/wishlist", label: "Saved" },
      { href: "/cart", label: "Cart", badge: cartCount > 0 ? cartCount : undefined },
    ];

    if (!user) return base;

    const authed: NavLink[] = [
      { href: "/orders", label: "Orders" },
      { href: "/profile", label: "Account" },
    ];

    if (canSeeSeller(user.role as Role)) authed.push({ href: "/seller", label: "Seller" });
    if (canSeeAdmin(user.role as Role)) authed.push({ href: "/admin", label: "Admin" });

    return [...base, ...authed];
  }, [cartCount, user]);

  const isActive = (href: string) =>
    href === "/" ? router.pathname === href : router.pathname === href || router.pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    await dispatch(logoutAsync());
    router.replace("/");
  };

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            mobile
              ? "flex items-center justify-between border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground"
              : `nav-link ${isActive(link.href) ? "nav-link-active" : ""}`
          }
          aria-current={isActive(link.href) ? "page" : undefined}
          onClick={() => mobile && setOpen(false)}
        >
          <span>{link.label}</span>
          {link.badge ? (
            <span className="tag-chip tag-chip-primary min-w-[1.75rem] justify-center">
              {link.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  );

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="page-shell !py-4">
          <div className="h-14 animate-pulse border border-border bg-secondary" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="border-b border-border/40 bg-secondary/30 text-muted-foreground">
        <div className="page-shell flex flex-col gap-2 !py-2 text-[11px] uppercase tracking-wider font-semibold sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4 text-primary" />
            <span>Curated marketplace shipping across India</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href={{ pathname: "/products", query: { sort: "newest" } }} className="hover:text-primary transition-colors">
              New arrivals
            </Link>
            <Link href={{ pathname: "/products", query: { inStock: "true" } }} className="hover:text-primary transition-colors">
              Ready to ship
            </Link>
            <Link href="/seller" className="hover:text-primary transition-colors">
              Seller studio
            </Link>
          </div>
        </div>
      </div>

      <div className="page-shell !py-4">
        <div className="grid items-center gap-4 md:grid-cols-[230px_minmax(300px,1fr)_auto_auto]">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center border border-primary bg-primary text-primary-foreground rounded shadow-[3px_3px_0_rgba(var(--primary-rgb),0.3)]">
              <ShoppingBagIcon className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-6" />
            </span>
            <span className="display-font text-2xl font-bold tracking-[0.18em] uppercase text-foreground transition-colors group-hover:text-primary">
              Luxora
            </span>
          </Link>

          <div className="hidden md:block">
            <SearchBar />
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <NavItems />
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {user ? (
              <>
                <button type="button" className="btn h-10 px-3 py-1.5" onClick={handleLogout}>
                  Logout
                </button>
                <Link href="/profile" className="btn h-10 w-10 px-0 flex items-center justify-center" aria-label="Account">
                  <UserCircleIcon className="h-5 w-5" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="btn h-10 px-4 py-1.5">
                  Sign in
                </Link>
                <Link href="/auth/register" className="btn-primary h-10 px-4 py-1.5">
                  Join
                </Link>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="btn h-10 w-10 px-0 flex items-center justify-center"
              aria-label="Open search"
              onClick={() => setMobileSearchOpen(true)}
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
            <Link href="/cart" className="btn relative h-10 w-10 px-0 flex items-center justify-center" aria-label="Cart">
              <ShoppingBagIcon className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className="btn h-10 w-10 px-0 flex items-center justify-center"
              aria-label="Open menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden border-t border-border/50 bg-card/60 md:block">
        <div className="page-shell flex items-center gap-2 overflow-x-auto !py-2">
          {departments.map((department) => (
            <Link
              key={department}
              href={{ pathname: "/products", query: getDepartmentQuery(department) }}
              className="rounded-full border border-transparent px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all duration-200"
            >
              {department}
            </Link>
          ))}
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="fixed inset-0 z-[60] bg-foreground/65 px-4 pt-20 md:hidden" onClick={() => setMobileSearchOpen(false)}>
          <div className="surface-card mx-auto max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Search Luxora</h2>
              <button type="button" className="btn h-10 w-10 px-0" onClick={() => setMobileSearchOpen(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <SearchBar />
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/65" />
          <div
            className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="display-font text-3xl font-semibold text-foreground">Luxora</span>
              <button type="button" className="btn h-10 w-10 px-0" onClick={() => setOpen(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-3">
              <NavItems mobile />
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Departments
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {departments.map((department) => (
                    <Link
                      key={department}
                      href={{ pathname: "/products", query: getDepartmentQuery(department) }}
                      className="border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      {department}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {user ? (
                <button type="button" className="btn col-span-2" onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <>
                  <Link href="/auth/login" className="btn" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/auth/register" className="btn-primary" onClick={() => setOpen(false)}>
                    Join
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
