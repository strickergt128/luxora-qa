import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getImageUrl } from "../utils/images";

type BannerData = {
  _id?: string;
  imageUrl: string;
  linkUrl?: string;
  altText?: string;
  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

type Props = {
  banner: BannerData;
  showAdBadge?: boolean;
  disableTracking?: boolean;
};

export default function BannerHero({
  banner,
  showAdBadge = true,
  disableTracking = false,
}: Props) {
  const {
    _id,
    imageUrl,
    linkUrl = "/products",
    altText,
    layout,
    imagePosition = "right",
    imageFit = "contain",
    headline,
    subheadline,
    ctaLabel,
  } = banner;

  const isSplit =
    layout === "split_asym" || Boolean(headline || subheadline || ctaLabel);
  const isImageRight = imagePosition !== "left";

  const imgBoxRef = useRef<HTMLAnchorElement | null>(null);
  const naturalRatioRef = useRef<number | null>(null);
  const [smartFit, setSmartFit] = useState<"contain" | "cover">(imageFit || "contain");

  const computeSmartFit = () => {
    if (imageFit === "cover") {
      setSmartFit("cover");
      return;
    }
    const imageRatio = naturalRatioRef.current;
    const element = imgBoxRef.current;
    if (!imageRatio || !element) {
      setSmartFit(imageFit || "contain");
      return;
    }

    const containerAspect = element.clientWidth / element.clientHeight;
    setSmartFit(imageRatio >= containerAspect * 1.05 ? "cover" : "contain");
  };

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const image = e.currentTarget;
    if (image.naturalWidth && image.naturalHeight) {
      naturalRatioRef.current = image.naturalWidth / image.naturalHeight;
      computeSmartFit();
    }
  };

  useEffect(() => {
    const onResize = () => computeSmartFit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const recordClick = () => {
    if (disableTracking || !_id) return;
    try {
      const url = `/api/banners/${_id}/click`;
      if ("sendBeacon" in navigator) {
        navigator.sendBeacon(url, new Blob([], { type: "application/octet-stream" }));
      } else {
        fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {}
  };

  if (!isSplit) {
    return (
      <section className="surface-card relative overflow-hidden">
        {showAdBadge ? (
          <div className="absolute left-4 top-4 z-10">
            <span className="tag-chip">Featured</span>
          </div>
        ) : null}
        <a href={linkUrl} onClick={recordClick} className="block">
          <img
            src={getImageUrl(imageUrl)}
            alt={altText || headline || "Promotional banner"}
            className="block h-72 w-full object-cover md:h-96"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/fallback.png")}
          />
        </a>
      </section>
    );
  }

  return (
    <section className="surface-card relative overflow-hidden">
      {showAdBadge ? (
        <div className="absolute left-4 top-4 z-10">
          <span className="tag-chip tag-chip-primary">Featured</span>
        </div>
      ) : null}

      <div className="grid gap-0 md:grid-cols-12">
        <div
          className={`${isImageRight ? "md:order-1" : "md:order-2"} flex items-center bg-secondary p-6 md:col-span-5 md:p-8`}
        >
          <div className="w-full">
            <div className="mb-4 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Curated Offer
            </div>
            {headline ? (
              <h3 className="text-2xl font-semibold text-foreground md:text-4xl">
                {headline}
              </h3>
            ) : null}
            {subheadline ? (
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                {subheadline}
              </p>
            ) : null}
            {ctaLabel ? (
              <div className="mt-6">
                <Link href={linkUrl} onClick={recordClick} className="btn-primary">
                  {ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`${isImageRight ? "md:order-2" : "md:order-1"} relative min-h-[280px] bg-background md:col-span-7`}
        >
          <a ref={imgBoxRef} href={linkUrl} onClick={recordClick} className="block h-full w-full">
            <img
              src={getImageUrl(imageUrl)}
              alt={altText || headline || "Promotional banner"}
              onLoad={onImgLoad}
              className={`block h-full min-h-[280px] w-full object-${smartFit === "cover" ? "cover" : "contain"} bg-card`}
              onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/fallback.png")}
            />
          </a>
        </div>
      </div>
    </section>
  );
}
