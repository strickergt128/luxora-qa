import Skeleton from "../ui/Skeleton";

export default function ProductCardSkeleton() {
  return (
    <div className="surface-card space-y-4 p-4">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
