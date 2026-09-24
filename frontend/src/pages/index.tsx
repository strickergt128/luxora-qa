import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { fetchProducts } from "../store/slices/productSlice";
import ProductCard from "../components/products/ProductCard";
import ProductCardSkeleton from "../components/products/ProductCardSkeleton";
import RecentlyViewed from "../components/products/RecentlyViewed";
import {
  ArrowRightIcon,
  SparklesIcon,
  StarIcon,
  TruckIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/api";
import BannerHero from "../components/BannerHero";

type Banner = {
  _id: string;
  title?: string;
  altText?: string;
  imageUrl: string;
  linkUrl?: string;
  placement: "home_hero" | "category_header";
  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

const departments = [
  { name: "Fashion", copy: "Tailored everyday pieces and accessories", href: { pathname: "/products", query: { category: "Fashion" } } },
  { name: "Electronics", copy: "Daily tech, audio, and smart essentials", href: { pathname: "/products", query: { category: "Electronics" } } },
  { name: "Home", copy: "Useful objects for quieter rooms", href: { pathname: "/products", query: { category: "Home" } } },
  { name: "Beauty", copy: "Care products from rated sellers", href: { pathname: "/products", query: { category: "Beauty" } } },
];

const signals = [
  { icon: ShieldCheckIcon, label: "Verified sellers" },
  { icon: TruckIcon, label: "Delivery clarity" },
  { icon: StarIcon, label: "Review-led buying" },
];

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { list, loading } = useSelector((s: RootState) => s.products);

  const [banner, setBanner] = useState<Banner | null>(null);
  const impressionSent = useRef(false);

  useEffect(() => {
    dispatch(fetchProducts({ limit: 8 }));
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("banners/active", {
          params: { placement: "home_hero" },
        });
        setBanner(data?.banner || null);
      } catch {
        setBanner(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!banner || impressionSent.current) return;
    impressionSent.current = true;
    api.post(`banners/${banner._id}/impression`).catch(() => {});
  }, [banner]);

  return (
    <div className="min-h-screen bg-background">
      <section className="page-shell grid gap-6 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="relative overflow-hidden border border-border/40 bg-card/60 backdrop-blur-md p-6 shadow-card md:p-10 rounded-xl hover:shadow-soft transition-all duration-300">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl">
            <span className="tag-chip tag-chip-primary mb-6 inline-flex">
              New edit live now
            </span>
            <h1 className="display-font max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl">
              Objects with taste, shipped with sense.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Browse fashion, electronics, home, and beauty picks from sellers
              with visible stock, clear prices, and review context before checkout.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/products" className="btn-primary px-6 py-3">
                Shop collection
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href={{ pathname: "/products", query: { sort: "newest" } }} className="btn px-6 py-3">
                New arrivals
              </Link>
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-3">
            {signals.map((item) => (
              <div key={item.label} className="flex items-center gap-3 border border-border/60 bg-secondary/40 px-4 py-3 rounded-md">
                <item.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid gap-4">
          <Link href={{ pathname: "/products", query: { search: "discount" } }} className="group border border-primary/20 bg-secondary/85 hover:bg-secondary transition-all duration-300 p-6 shadow-card rounded-xl hover:-translate-y-1 hover:shadow-soft">
            <TagIcon className="h-7 w-7 text-primary" />
            <h2 className="display-font mt-5 text-4xl font-semibold text-foreground">Private-sale energy</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Discounted items, live stock, and quick product comparisons.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Browse deals <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <div className="border border-border/50 bg-card/60 backdrop-blur-md p-6 shadow-card rounded-xl hover:shadow-soft transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center border border-primary/30 bg-primary/10 text-primary rounded-md">
                <ShoppingBagIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="display-font text-4xl font-semibold text-foreground">{list.length || 8}+</div>
                <p className="text-sm text-muted-foreground">products ready to browse</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {banner ? (
        <section className="page-shell pb-0 pt-2">
          <BannerHero banner={banner} />
        </section>
      ) : null}

      <section className="page-shell py-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="display-font text-4xl font-semibold text-foreground">Departments</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start wide, then filter by price, stock, and rating.</p>
          </div>
          <Link href="/products" className="hidden text-sm font-semibold text-primary hover:text-primary-hover sm:inline-flex">
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((item, index) => (
            <Link key={item.name} href={item.href} className="group border border-border/40 bg-card/60 backdrop-blur-md p-5 shadow-card rounded-lg hover:border-primary/40 hover:bg-card hover:-translate-y-1 hover:shadow-soft transition-all duration-300">
              <div className="mb-8 flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center border border-primary/25 bg-primary/10 text-primary rounded-md">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="display-font text-3xl font-semibold text-foreground">{item.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Shop now <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="display-font text-4xl font-semibold text-foreground">
              New arrivals
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fresh products with current stock, ratings, and seller details.
            </p>
          </div>
          <Link href="/products" className="btn hidden sm:inline-flex">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {list.slice(0, 8).map((p, i) => (
              <div key={p._id} className="animate-fade-in-up" style={{ animationDelay: `${(i % 4) * 80}ms` }}>
                <ProductCard p={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-border/50 bg-secondary/25 backdrop-blur-md py-12">
        <div className="page-shell !py-0">
          <RecentlyViewed title="Recently viewed" />
        </div>
      </section>

      <section className="page-shell py-12">
        <div className="grid gap-6 border border-primary/25 bg-secondary/40 backdrop-blur-md p-8 shadow-card rounded-xl md:grid-cols-[1fr_auto] md:items-center hover:border-primary/40 hover:shadow-soft transition-all duration-300">
          <div className="max-w-2xl">
            <h3 className="display-font text-4xl font-semibold text-foreground">
              Seller tools without theatre.
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add products, track orders, and manage availability from one
              calm operating dashboard.
            </p>
          </div>
          <Link href="/seller" className="btn-primary shrink-0 px-6 py-3">
            Open seller studio
          </Link>
        </div>
      </section>
    </div>
  );
}
