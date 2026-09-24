export function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export const shortDate = (d: string | number | Date) =>
  new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(d));
