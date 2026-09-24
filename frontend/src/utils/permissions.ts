export type AnyUser = { role?: string; permissions?: string[] };

export const isAdmin = (u?: AnyUser | null) => u?.role === "admin";
export const isSubadmin = (u?: AnyUser | null) => u?.role === "subadmin";
export const isSeller = (u?: AnyUser | null) => u?.role === "seller";
export const isSellerAssistant = (u?: AnyUser | null) =>
  u?.role === "seller_assistant";

// Admin/subadmin surface perms
export const hasPerm = (u: AnyUser | null | undefined, perm: string) => {
  if (!u) return false;
  if (isAdmin(u)) return true;
  if (isSubadmin(u)) return (u.permissions || []).includes(perm);
  return false;
};
export const hasAllPerms = (u: AnyUser | null | undefined, perms: string[]) =>
  perms.every((p) => hasPerm(u, p));
export const hasAnyPerm = (u: AnyUser | null | undefined, perms: string[]) =>
  perms.some((p) => hasPerm(u, p));

// Seller/assistant surface perms
export const hasSellerPerm = (
  u: AnyUser | null | undefined,
  perm: string
) => {
  if (!u) return false;
  if (isSeller(u)) return true; // seller bypass
  if (isSellerAssistant(u)) return (u.permissions || []).includes(perm);
  // Allow admin/subadmin to pass through seller areas if needed
  if (isAdmin(u) || isSubadmin(u)) return true;
  return false;
};
export const hasSellerAll = (u: AnyUser | null | undefined, perms: string[]) =>
  perms.every((p) => hasSellerPerm(u, p));
export const hasSellerAny = (u: AnyUser | null | undefined, perms: string[]) =>
  perms.some((p) => hasSellerPerm(u, p));