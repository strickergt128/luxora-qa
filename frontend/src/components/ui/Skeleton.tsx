export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-border bg-secondary/80 ${className}`}
    />
  );
}
