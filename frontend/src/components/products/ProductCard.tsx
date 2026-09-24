import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FireIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
} from "@heroicons/react/24/solid";
import type { Product } from "../../store/slices/productSlice";
import { currency } from "../../utils/format";
import { getImageUrl } from "../../utils/images";

export default function ProductCard({
  p,
}: {
  p: Product & { isSponsored?: boolean };
}) {
  const image = getImageUrl(p.images?.[0]);
  const [imgSrc, setImgSrc] = useState(image);

  useEffect(() => {
    setImgSrc(image);
  }, [image]);

  const hasDiscount =
    typeof p.discountPrice === "number" && p.discountPrice >= 0 && p.discountPrice < p.price;

  const displayPrice = hasDiscount ? p.discountPrice! : p.price;
  const discountPercent = hasDiscount
    ? Math.round(((p.price - (p.discountPrice || 0)) / p.price) * 100)
    : 0;

  const stock = typeof p.stock === "number" ? p.stock : 0;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 5;
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 2) : [];

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-border/40 bg-card/60 backdrop-blur-md transition-all duration-300 hover:shadow-soft rounded-lg hover:-translate-y-1">
      <Link href={`/products/${p._id}`} className="relative block overflow-hidden bg-secondary/30">
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <Image
            src={imgSrc}
            alt={p.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            unoptimized
            onError={() => {
              if (imgSrc !== "/fallback.png") setImgSrc("/fallback.png");
            }}
          />
        </div>

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 z-10">
          {hasDiscount ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500 backdrop-blur-md">
              <TagIcon className="h-3 w-3" />
              {discountPercent}% OFF
            </span>
          ) : null}
          {p.isSponsored ? (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur-md">
              <SparklesIcon className="h-3 w-3" />
              Featured
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-3 right-3 z-10">
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${
            inStock 
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" 
              : "bg-rose-500/10 border border-rose-500/20 text-rose-500"
          }`}>
            {lowStock ? `${stock} left` : inStock ? "In Stock" : "Sold out"}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <SparklesIcon className="h-3 w-3 text-primary/80" />
              <span className="truncate">{p.brand || "Luxora"}</span>
            </div>
            <Link href={`/products/${p._id}`} className="block">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors duration-200">
                {p.title}
              </h3>
            </Link>
          </div>
          {typeof p.avgRating === "number" ? (
            <div className="flex shrink-0 items-center gap-1 rounded border border-border/50 bg-secondary/40 px-1.5 py-0.5 text-xs font-medium text-foreground">
              <StarIcon className="h-3 w-3 text-amber-500" />
              {p.avgRating.toFixed(1)}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-end gap-2">
          <div className="text-lg font-semibold text-foreground tracking-tight">{currency(displayPrice)}</div>
          {hasDiscount ? (
            <div className="text-xs text-muted-foreground line-through pb-0.5">
              {currency(p.price)}
            </div>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded bg-secondary/50 border border-border/40 px-1.5 py-0.5 text-[9px] text-muted-foreground tracking-wider uppercase">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 pt-1">
          <Link href={`/products/${p._id}`} className="btn-primary w-full text-xs font-semibold py-2">
            View Product
          </Link>
        </div>
      </div>
    </article>
  );
}
