/**
 * Error Alert Component
 * Displays user-friendly error messages with actions
 * Requirements: 9.2
 */

import { AlertCircle, RefreshCw, X, WifiOff, ShieldAlert, Ban, Search, Clock, ServerCrash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { ErrorType, ParsedError } from '@/services/api/types';
import { getErrorTitle, getSuggestedAction, isRetryableError } from '@/services/api/errors';

interface ErrorAlertProps {
  error: ParsedError | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showSuggestion?: boolean;
}

/**
 * Get icon for error type
 */
const getErrorIcon = (type: ErrorType) => {
  switch (type) {
    case 'network':
      return WifiOff;
    case 'auth':
      return ShieldAlert;
    case 'forbidden':
      return Ban;
    case 'not_found':
      return Search;
    case 'rate_limit':
      return Clock;
    case 'server':
      return ServerCrash;
    case 'validation':
    default:
      return AlertCircle;
  }
};

/**
 * Get variant for error type
 */
const getAlertVariant = (type: ErrorType): 'default' | 'destructive' => {
  switch (type) {
    case 'network':
    case 'rate_limit':
      return 'default';
    default:
      return 'destructive';
  }
};

export function ErrorAlert({
  error,
  onRetry,
  onDismiss,
  className,
  showSuggestion = true,
}: ErrorAlertProps) {
  if (!error) return null;

  // Convert string error to ParsedError
  const parsedError: ParsedError = typeof error === 'string'
    ? { type: 'server', message: error }
    : error;

  const Icon = getErrorIcon(parsedError.type);
  const variant = getAlertVariant(parsedError.type);
  const title = getErrorTitle(parsedError);
  const canRetry = isRetryableError(parsedError);
  const suggestion = showSuggestion ? getSuggestedAction(parsedError) : null;

  return (
    <Alert variant={variant} className={cn('relative', className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="pr-8">{title}</AlertTitle>
      <AlertDescription className="mt-1">
        <p>{parsedError.message}</p>
        {suggestion && (
          <p className="text-xs mt-1 opacity-80">{suggestion}</p>
        )}
        {(onRetry || onDismiss) && (
          <div className="flex gap-2 mt-3">
            {onRetry && canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}

/**
 * Inline error message for forms and inputs
 */
interface InlineErrorProps {
  message: string | null | undefined;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  if (!message) return null;

  return (
    <p className={cn('text-sm text-destructive flex items-center gap-1', className)}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}

/**
 * Empty state with error styling
 */
interface ErrorEmptyStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorEmptyState({
  title = 'Error',
  message,
  onRetry,
  className,
}: ErrorEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}
