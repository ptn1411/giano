/**
 * Rate Limit Notice Component
 * Displays a friendly message when user hits rate limit
 */

import { AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface RateLimitNoticeProps {
  message: string;
  retryAfter?: number;
}

export function RateLimitNotice({ message, retryAfter }: RateLimitNoticeProps) {
  // Extract retry seconds from message if not provided
  const seconds = retryAfter || parseInt(message.match(/\d+/)?.[0] || '60');
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  const timeText = minutes > 0 
    ? `${minutes} minute${minutes > 1 ? 's' : ''}${remainingSeconds > 0 ? ` ${remainingSeconds} seconds` : ''}`
    : `${seconds} seconds`;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Too Many Login Attempts
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          For security reasons, we've temporarily blocked login attempts from this account.
        </p>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          <span>Please try again in {timeText}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This helps protect your account from unauthorized access attempts.
        </p>
      </AlertDescription>
    </Alert>
  );
}
