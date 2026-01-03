import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
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
  className?: string;
}

const statusConfig: Record<DeliveryStatus, { 
  icon: typeof Check; 
  label: string; 
  colorClass: string;
}> = {
  sending: {
    icon: Clock,
    label: "Sending...",
    colorClass: "text-primary-foreground/50",
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
    label: "Failed to send",
    colorClass: "text-destructive",
  },
};

export function DeliveryStatusIcon({ status, isOwn, className }: DeliveryStatusIconProps) {
  if (!isOwn) return null;
  
  const config = statusConfig[status] || statusConfig.sent;
  const Icon = config.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          <Icon 
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isOwn ? config.colorClass : "text-muted-foreground"
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