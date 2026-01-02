import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => {
        const isOwn = i % 3 === 1;
        return (
          <div
            key={i}
            className={cn(
              "flex gap-2 animate-fade-in",
              isOwn ? "justify-end" : "justify-start"
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {!isOwn && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
            <div className={cn("space-y-2", isOwn ? "items-end" : "items-start")}>
              <Skeleton 
                className={cn(
                  "h-16 rounded-2xl",
                  isOwn ? "w-48 rounded-br-md" : "w-56 rounded-bl-md"
                )} 
              />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
