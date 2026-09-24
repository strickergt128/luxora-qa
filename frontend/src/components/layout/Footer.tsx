import Link from "next/link";

const groups = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "Products" },
      { href: "/wishlist", label: "Saved" },
      { href: "/cart", label: "Cart" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/auth/login", label: "Login" },
      { href: "/auth/register", label: "Register" },
      { href: "/profile", label: "Profile" },
      { href: "/seller/apply", label: "Become a seller" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/policies/terms", label: "Terms" },
      { href: "/policies/privacy", label: "Privacy" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies/shipping", label: "Shipping" },
      { href: "/policies/returns", label: "Returns" },
      { href: "/policies/cookies", label: "Cookies" },
      { href: "/policies/payments", label: "Payments" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border/50 bg-secondary/30 backdrop-blur-md text-foreground">
      <div className="page-shell space-y-10">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <div className="display-font mb-4 text-2xl font-bold tracking-[0.2em] uppercase text-foreground">
              Luxora
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Curated products, clear seller tools, secure checkout, and simple
              order tracking in one marketplace.
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Verified sellers</span>
              <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Secure checkout</span>
              <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Order tracking</span>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © {year} <span className="font-semibold text-foreground">Luxora</span>. All rights reserved.
          </p>
          <p>Designed for buying, selling, and keeping operations tidy.</p>
        </div>
      </div>
    </footer>
  );
}
