import { useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import ZoomPlugin from "yet-another-react-lightbox/plugins/zoom";
import ThumbnailsPlugin from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { getImageUrl } from "../../utils/images";
import { classifyVideoUrl } from "../../utils/media";

type Img = string | { url?: string; alt?: string };

type Props = {
  title: string;
  images: Img[] | undefined;
  videoUrl?: string; // optional product video
};

type Active = { type: "image"; index: number } | { type: "video" };

export default function ProductGallery({
  title,
  images = [],
  videoUrl,
}: Props) {
  const imageUrls = useMemo(
    () =>
      (images || []).map((img) =>
        typeof img === "string" ? getImageUrl(img) : getImageUrl(img.url || "")
      ),
    [images]
  );

  // Ensure uploaded /uploads/... video gets prefixed via getImageUrl
  const videoSrc = useMemo(
    () => (videoUrl ? getImageUrl(videoUrl) : undefined),
    [videoUrl]
  );
  const videoInfo = useMemo(() => classifyVideoUrl(videoSrc), [videoSrc]);

  const [active, setActive] = useState<Active>(
    imageUrls.length
      ? { type: "image", index: 0 }
      : videoUrl
      ? { type: "video" }
      : { type: "image", index: 0 }
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Desktop hover zoom state
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  // Mobile pinch + pan + double tap
  const [scale, setScale] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const startPanRef = useRef<{ x: number; y: number } | null>(null);
  const startOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const activeImageUrl =
    active.type === "image" ? imageUrls[active.index] : undefined;

  const slides = useMemo(() => imageUrls.map((src) => ({ src })), [imageUrls]);

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    setZoomPos({ x, y });
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const d = dist(e.touches[0], e.touches[1]);
      pinchDistRef.current = d;
      setBaseScale(scale);
      startPanRef.current = null;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      setZoomPos({
        x: clamp((mx / rect.width) * 100, 0, 100),
        y: clamp((my / rect.height) * 100, 0, 100),
      });
      return;
    }
    if (e.touches.length === 1 && scale > 1) {
      startPanRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      startOffsetRef.current = { ...offset };
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchDistRef.current) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const ratio = d / pinchDistRef.current;
      const next = clamp(baseScale * ratio, 1, 3);
      setScale(next);
      return;
    }
    if (e.touches.length === 1 && startPanRef.current && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - startPanRef.current.x;
      const dy = e.touches[0].clientY - startPanRef.current.y;
      const nx = clamp((startOffsetRef.current?.x || 0) + dx, -200, 200);
      const ny = clamp((startOffsetRef.current?.y || 0) + dy, -200, 200);
      setOffset({ x: nx, y: ny });
    }
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 0) {
      pinchDistRef.current = null;
      startPanRef.current = null;
      startOffsetRef.current = null;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const next = scale > 1 ? 1 : 2;
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  }

  function dist(a: React.Touch, b: React.Touch) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  useEffect(() => {
    // Reset zoom state when switching items
    setScale(1);
    setBaseScale(1);
    setOffset({ x: 0, y: 0 });
    setIsZooming(false);
  }, [active.type, activeImageUrl]);

  return (
    <div className="flex flex-col">
      {/* Main viewer */}
      <div
        className={`relative mb-5 w-full overflow-hidden border border-border bg-card shadow-card ${
          active.type === "image" ? "cursor-zoom-in" : ""
        }`}
        style={{ height: "min(70vh, 64vw)" }}
        onMouseMove={active.type === "image" ? onMouseMove : undefined}
        onMouseEnter={() => active.type === "image" && setIsZooming(true)}
        onMouseLeave={() => active.type === "image" && setIsZooming(false)}
        onClick={() => active.type === "image" && setLightboxOpen(true)}
        onTouchStart={active.type === "image" ? onTouchStart : undefined}
        onTouchMove={active.type === "image" ? onTouchMove : undefined}
        onTouchEnd={active.type === "image" ? onTouchEnd : undefined}
      >
        {active.type === "image" && activeImageUrl ? (
          <img
            src={activeImageUrl}
            alt={title}
            className="h-full w-full select-none object-contain transition-transform duration-150"
            style={{
              transform:
                scale > 1
                  ? `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
                  : isZooming
                  ? "scale(2)"
                  : "scale(1)",
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
            }}
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
            }
          />
        ) : active.type === "video" && videoSrc ? (
          videoInfo.kind === "file" ? (
            <video
              src={videoInfo.src}
              className="h-full w-full bg-black object-contain"
              controls
              playsInline
            />
          ) : (
            <iframe
              src={videoInfo.src}
              title="Product video"
              className="h-full w-full bg-black"
              style={{ border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )
        ) : null}
        {/* md+ fixed height spacer for layout stability */}
        <div
          className="hidden md:block absolute inset-0"
          style={{ height: 480 }}
        />
      </div>

      {/* Thumbnails row (includes video tile if present) */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {videoSrc && (
          <button
            type="button"
            onClick={() => setActive({ type: "video" })}
            className={`relative h-20 w-20 flex-shrink-0 snap-start overflow-hidden border border-border ${
              active.type === "video" ? "ring-2 ring-primary" : ""
            } bg-black`}
            title="Video"
          >
            <div className="absolute inset-0 grid place-items-center">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white/90"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
        {imageUrls.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`${title} ${i + 1}`}
            className={`h-20 w-20 flex-shrink-0 cursor-pointer snap-start border border-border object-cover ${
              active.type === "image" && active.index === i
                ? "ring-2 ring-primary"
                : ""
            }`}
            onClick={() => setActive({ type: "image", index: i })}
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
            }
          />
        ))}
      </div>

      {/* Lightbox for images */}
      {lightboxOpen && slides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={slides}
          index={active.type === "image" ? active.index : 0}
          carousel={{ finite: false }}
          plugins={[ZoomPlugin, ThumbnailsPlugin]}
          render={{
            buttonPrev: () => null,
            buttonNext: () => null,
          }}
        />
      )}
    </div>
  );
}
