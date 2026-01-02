import { cn } from "@/lib/utils";

interface AvatarWithStatusProps {
  src: string;
  alt: string;
  status?: 'online' | 'offline' | 'away';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const statusSizeClasses = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
};

const statusColors = {
  online: 'bg-emerald-500',
  offline: 'bg-muted',
  away: 'bg-amber-500',
};

export function AvatarWithStatus({
  src,
  alt,
  status,
  size = 'md',
  className,
}: AvatarWithStatusProps) {
  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <img
        src={src}
        alt={alt}
        className={cn(
          sizeClasses[size],
          "rounded-full object-cover ring-2 ring-card"
        )}
      />
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-card",
            statusSizeClasses[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}
