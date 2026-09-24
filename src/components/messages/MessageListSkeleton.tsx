import { Skeleton } from "@ui";

export function MessageListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex gap-3 px-4 py-2.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
