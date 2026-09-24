import { useEffect, useRef, useState, Fragment } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import type { RootState, AppDispatch } from "../../store";
import { fetchProducts } from "../../store/slices/productSlice";
import ProductCard from "../../components/products/ProductCard";
import ProductCardSkeleton from "../../components/products/ProductCardSkeleton";
import { Listbox, Dialog, Transition } from "@headlessui/react";
import api from "../../utils/api";
import BannerHero from "../../components/BannerHero";

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

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const CATEGORIES = ["Fashion", "Electronics", "Home", "Beauty"];
const PRICE_OPTIONS: Array<{ label: string; range: [number, number] }> = [
  { label: "Under ₹500", range: [0, 500] },
  { label: "₹500 - ₹2,000", range: [500, 2000] },
  { label: "₹2,000 - ₹5,000", range: [2000, 5000] },
  { label: "₹5,000 - ₹10,000", range: [5000, 10000] },
];

const priceRangeLabel = (range: [number, number] | null) => {
  if (!range) return "";
  const hit = PRICE_OPTIONS.find(
    (item) => item.range[0] === range[0] && item.range[1] === range[1]
  );
  return hit?.label || `${range[0]} - ${range[1]}`;
};

const getQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parsePriceRange = (value: string | string[] | undefined): [number, number] | null => {
  const raw = getQueryValue(value);
  if (!raw) return null;
  const [min, max] = raw.split(",").map((item) => Number(item));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
};

export default function ProductsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { list, loading } = useSelector((s: RootState) => s.products);

  const router = useRouter();
  const searchParam = router.query.search as string | undefined;

  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [minRating, setMinRating] = useState<number>(0);
  const [inStock, setInStock] = useState<boolean>(false);

  const [categoryBanner, setCategoryBanner] = useState<Banner | null>(null);
  const catBannerImpressionRef = useRef<string | null>(null);

  const lastParamsRef = useRef<Record<string, string | number | boolean> | null>(null);

  const sortOptions = [
    { value: "", label: "Sort by" },
    { value: "priceAsc", label: "Price: Low → High" },
    { value: "priceDesc", label: "Price: High → Low" },
    { value: "newest", label: "Newest" },
  ];

  const ratingOptions = [
    { value: 0, label: "Any rating" },
    { value: 1, label: "1★ & up" },
    { value: 2, label: "2★ & up" },
    { value: 3, label: "3★ & up" },
    { value: 4, label: "4★ & up" },
  ];

  const buildParams = (): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (searchParam) params.q = searchParam;
    if (sort) params.sort = sort;
    if (category) params.category = category;
    if (priceRange) params.priceRange = priceRange.join(",");
    if (minRating > 0) params.minRating = minRating;
    if (inStock) params.inStock = true;
    return params;
  };

  useEffect(() => {
    if (!router.isReady) return;
    const nextCategory = getQueryValue(router.query.category) || "";
    const nextSort = getQueryValue(router.query.sort) || "";
    const nextRating = Number(getQueryValue(router.query.minRating) || 0);

    setCategory(nextCategory);
    setSort(sortOptions.some((item) => item.value === nextSort) ? nextSort : "");
    setMinRating(Number.isFinite(nextRating) ? Math.min(Math.max(nextRating, 0), 4) : 0);
    setInStock(getQueryValue(router.query.inStock) === "true");
    setPriceRange(parsePriceRange(router.query.priceRange));
  }, [
    router.isReady,
    router.query.category,
    router.query.sort,
    router.query.minRating,
    router.query.inStock,
    router.query.priceRange,
  ]);

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const query: Record<string, string> = { category: newCategory };
    router.push({ pathname: "/products", query }, undefined, { shallow: true });
  };

  useEffect(() => {
    const params = buildParams();
    lastParamsRef.current = params;
    dispatch(fetchProducts(params));
  }, [searchParam, sort, category, priceRange, minRating, inStock]);

  useEffect(() => {
    if (list.length === 0) {
      const params = buildParams();
      lastParamsRef.current = params;
      dispatch(fetchProducts(params));
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!category) {
        setCategoryBanner(null);
        catBannerImpressionRef.current = null;
        return;
      }
      try {
        const slug = slugify(category);
        const { data } = await api.get("banners/active", {
          params: { placement: "category_header", categorySlug: slug },
        });
        setCategoryBanner(data?.banner || null);
      } catch {
        setCategoryBanner(null);
      }
      catBannerImpressionRef.current = null;
    };
    run();
  }, [category]);

  useEffect(() => {
    if (!categoryBanner) return;
    if (catBannerImpressionRef.current === categoryBanner._id) return;
    catBannerImpressionRef.current = categoryBanner._id;
    api.post(`banners/${categoryBanner._id}/impression`).catch(() => {});
  }, [categoryBanner]);

  const onClearFilters = () => {
    setCategory("");
    setPriceRange(null);
    setSort("");
    setMinRating(0);
    setInStock(false);
    setCategoryBanner(null);
    catBannerImpressionRef.current = null;
    router.push("/products", undefined, { shallow: true });
  };

  const isInitialLoading = loading && list.length === 0;

  const activeFilters: Array<{ key: string; label: string }> = [];
  if (category) activeFilters.push({ key: "category", label: `Category: ${category}` });
  if (priceRange)
    activeFilters.push({
      key: "priceRange",
      label: `Price: ${priceRangeLabel(priceRange)}`,
    });
  if (minRating > 0)
    activeFilters.push({ key: "minRating", label: `Rating: ${minRating}★ & up` });
  if (inStock) activeFilters.push({ key: "inStock", label: "In stock" });
  if (sort) {
    const sortLabel = sortOptions.find((s) => s.value === sort)?.label || "Sort";
    activeFilters.push({ key: "sort", label: sortLabel });
  }

  const clearOneFilter = (key: string) => {
    if (key === "category") {
      setCategory("");
      router.push("/products", undefined, { shallow: true });
    }
    if (key === "priceRange") setPriceRange(null);
    if (key === "minRating") setMinRating(0);
    if (key === "inStock") setInStock(false);
    if (key === "sort") setSort("");
  };

  const searchInfo = searchParam ? (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 text-foreground">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Showing results for <strong className="ml-1 text-foreground normal-case font-bold">{searchParam}</strong>
      </span>
      <button
        onClick={() => router.push("/products", undefined, { shallow: true })}
        className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors"
      >
        Clear search
      </button>
    </div>
  ) : null;

  return (
    <div className="page-shell grid gap-8 md:grid-cols-4">
      {/* Sidebar */}
      <aside className="hidden h-fit space-y-6 bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft md:block">
        <button
          onClick={onClearFilters}
          className="btn w-full py-2.5 text-xs font-semibold uppercase tracking-wider"
        >
          Clear filters
        </button>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1.5">Categories</h3>
          <div className="space-y-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => handleCategoryChange(c)}
                className={`block w-full rounded-md border px-3.5 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/40 bg-card/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1.5">Price</h3>
          <div className="space-y-1">
            {PRICE_OPTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => setPriceRange(r.range as [number, number])}
                className={`block w-full rounded-md border px-3.5 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  priceRange &&
                  priceRange[0] === r.range[0] &&
                  priceRange[1] === r.range[1]
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/40 bg-card/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1.5">Ratings</h3>
          <div className="space-y-1">
            {ratingOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setMinRating(o.value)}
                className={`block w-full rounded-md border px-3.5 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  minRating === o.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/40 bg-card/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1.5">Availability</h3>
          <label className="flex select-none items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="w-4 h-4 border border-border text-primary rounded focus:ring-primary focus:ring-offset-0 shrink-0"
            />
            In stock only
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <div className="space-y-6 md:col-span-3">
        <div className="flex flex-col gap-4 border border-border/40 bg-card/65 backdrop-blur-md p-6 rounded-xl shadow-soft md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Luxora Catalog</p>
            <h1 className="display-font text-4xl font-semibold text-foreground md:text-5xl mt-1">
              Browse the edit
            </h1>
          </div>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">
            Curated and tailored to meet our exacting standards. Filter through our select collections by category, pricing, or ratings.
          </p>
        </div>
        {searchInfo}

        <div className="md:hidden -mx-1 overflow-x-auto no-scrollbar sticky top-[68px] z-30 bg-background/90 backdrop-blur-md py-2">
          <div className="flex gap-2 px-1 min-w-max">
            <button
              onClick={() => setCategory("")}
              className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border ${
                !category ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => handleCategoryChange(c)}
                className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border whitespace-nowrap ${
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border/60 text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => clearOneFilter(chip.key)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {chip.label}
                  <span aria-hidden className="ml-1 text-xs">×</span>
                </button>
              ))}
              <button
                onClick={onClearFilters}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Sort dropdown */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {list.length} result{list.length === 1 ? "" : "s"}
          </p>
          <Listbox value={sort} onChange={setSort}>
            <div className="relative w-48">
              <Listbox.Button className="w-full rounded-md border border-border/80 bg-card/65 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground focus:outline-none focus:border-primary transition-all duration-200">
                {["", "priceAsc", "priceDesc", "newest"].includes(sort)
                  ? {
                      "": "Sort by",
                      priceAsc: "Price: Low → High",
                      priceDesc: "Price: High → Low",
                      newest: "Newest",
                    }[sort as "" | "priceAsc" | "priceDesc" | "newest"]
                  : "Sort by"}
              </Listbox.Button>
              <Listbox.Options className="absolute z-50 mt-2 w-full space-y-1 rounded-md border border-border/40 bg-card/90 backdrop-blur-md p-2 shadow-lg">
                {[
                  { value: "", label: "Sort by" },
                  { value: "priceAsc", label: "Price: Low → High" },
                  { value: "priceDesc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest" },
                ].map((o) => (
                  <Listbox.Option
                    key={o.value}
                    value={o.value}
                    className="cursor-pointer rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {o.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Mobile Filters Button */}
        <button
          className="btn-primary mt-4 block w-full py-4 text-center md:hidden"
          onClick={() => setShowFilters(true)}
        >
          Show filters
        </button>

        {categoryBanner ? <BannerHero banner={categoryBanner} /> : null}

        {/* Mobile Filters Modal */}
        <Transition show={showFilters} as={Fragment}>
          <Dialog
            onClose={() => setShowFilters(false)}
            className="relative z-50"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 flex items-end justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="translate-y-full"
                enterTo="translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="translate-y-0"
                leaveTo="translate-y-full"
              >
                <Dialog.Panel className="max-h-[85vh] w-full max-w-md space-y-6 overflow-y-auto rounded-t-2xl border border-border/40 bg-card p-6 pb-20">
                  <div className="flex justify-between items-center border-b border-border/30 pb-3">
                    <Dialog.Title className="display-font text-lg font-semibold text-foreground">
                      Filters
                    </Dialog.Title>
                    <button
                      onClick={onClearFilters}
                      className="text-xs font-semibold uppercase tracking-wider text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      Reset all
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Categories
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleCategoryChange(c)}
                          className={`rounded-md border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                            category === c
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/40 bg-card/45 text-muted-foreground"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {PRICE_OPTIONS.map((r) => (
                        <button
                          key={r.label}
                          onClick={() =>
                            setPriceRange(r.range as [number, number])
                          }
                          className={`rounded-md border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                            priceRange &&
                            priceRange[0] === r.range[0] &&
                            priceRange[1] === r.range[1]
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/40 bg-card/45 text-muted-foreground"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Ratings
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {ratingOptions.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setMinRating(o.value)}
                          className={`rounded-md border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                            minRating === o.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/40 bg-card/45 text-muted-foreground"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Availability
                    </h3>
                    <label className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inStock}
                        onChange={(e) => setInStock(e.target.checked)}
                        className="w-4 h-4 border border-border text-primary rounded focus:ring-primary focus:ring-offset-0 shrink-0"
                      />
                      In stock only
                    </label>
                  </div>

                  <div className="sticky bottom-0 flex justify-between gap-4 border-t border-border/30 bg-card pt-4">
                    <button
                      onClick={onClearFilters}
                      className="btn flex-1 py-3 text-xs"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="btn-primary flex-1 py-3 text-xs"
                    >
                      Apply
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Grid */}
        {isInitialLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl p-12 text-center flex flex-col items-center justify-center">
            <h2 className="display-font mb-4 text-3xl font-semibold text-foreground">
              No products found
            </h2>
            <p className="mb-8 max-w-sm text-sm text-muted-foreground">
              {searchParam
                ? "Try adjusting your search query or clear it to view our complete collection."
                : "Try adjusting your filter settings or clear all filters to start fresh."}
            </p>
            <button
              onClick={onClearFilters}
              className="btn-primary"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 transition-opacity duration-200 ${
              loading ? "opacity-50" : ""
            }`}
          >
            {list.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
