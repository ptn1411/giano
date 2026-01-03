import { Check, CheckCheck, Clock, AlertCircle, RotateCw } from "lucide-react";
import { DeliveryStatus } from "@/services/mockData";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeliveryStatusIconProps {
  status: DeliveryStatus;
  isOwn: boolean;
  onRetry?: () => void;
  className?: string;
}

const statusConfig: Record<DeliveryStatus, { 
  icon: typeof Check; 
  label: string; 
  colorClass: string;
  animate?: boolean;
}> = {
  sending: {
    icon: Clock,
    label: "Sending...",
    colorClass: "text-primary-foreground/50",
    animate: true,
  },
  sent: {
    icon: Check,
    label: "Sent",
    colorClass: "text-primary-foreground/70",
  },
  delivered: {
    icon: CheckCheck,
    label: "Delivered",
    colorClass: "text-primary-foreground/70",
  },
  read: {
    icon: CheckCheck,
    label: "Read",
    colorClass: "text-sky-300",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed to send. Tap to retry.",
    colorClass: "text-destructive",
  },
};

export function DeliveryStatusIcon({ status, isOwn, onRetry, className }: DeliveryStatusIconProps) {
  if (!isOwn) return null;
  
  const config = statusConfig[status] || statusConfig.sent;
  const Icon = config.icon;
  const isFailed = status === 'failed';
  
  if (isFailed && onRetry) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onRetry}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
              "bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors",
              className
            )}
          >
            <AlertCircle className="h-3 w-3" />
            <span>Failed</span>
            <RotateCw className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          <Icon 
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isOwn ? config.colorClass : "text-muted-foreground",
              config.animate && "animate-pulse"
            )} 
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}