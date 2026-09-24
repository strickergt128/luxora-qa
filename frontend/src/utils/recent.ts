export type RecentProduct = {
  _id: string;
  title: string;
  price: number;
  images?: any[]; // keep as-is; ProductCard/getImageUrl handles shapes
};

const KEY = "recently_viewed_v1";
const MAX_ITEMS = 16;

function safeParse(json: string | null) {
  try {
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export function getRecent(limit: number = MAX_ITEMS): RecentProduct[] {
  if (typeof window === "undefined") return [];
  const arr = safeParse(localStorage.getItem(KEY));
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, limit);
}

export function addRecent(p: RecentProduct) {
  if (typeof window === "undefined" || !p || !p._id) return;
  const arr: RecentProduct[] = getRecent(MAX_ITEMS);
  const filtered = arr.filter((x) => x && x._id !== p._id);
  const next = [p, ...filtered].slice(0, MAX_ITEMS);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeRecent(id: string) {
  if (typeof window === "undefined") return;
  const arr: RecentProduct[] = getRecent(MAX_ITEMS).filter((x) => x._id !== id);
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function clearRecent() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
