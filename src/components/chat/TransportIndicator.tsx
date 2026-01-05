/**
 * Transport Indicator Component
 * Shows current transport type (QUIC/WebSocket) and connection quality metrics
 * Requirement 5.5: Display connection quality metrics
 */

import { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { wsClient } from '@/services/websocket';
import { TransportType, PerformanceMetrics } from '@/services/transport-manager';

interface TransportIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function TransportIndicator({ showDetails = false, className }: TransportIndicatorProps) {
  const [transportType, setTransportType] = useState<TransportType>(TransportType.Unknown);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    // Update transport type and connection status
    const updateStatus = () => {
      // Check if wsClient has getTransportType method (transport-enabled client)
      if ('getTransportType' in wsClient && typeof wsClient.getTransportType === 'function') {
        setTransportType(wsClient.getTransportType());
      } else {
        // Fallback to WebSocket if using legacy client
        setTransportType(TransportType.WebSocket);
      }
      setIsConnected(wsClient.isConnected());

      // Get metrics if available
      if ('getMetrics' in wsClient && typeof wsClient.getMetrics === 'function') {
        const currentMetrics = wsClient.getMetrics();
        setMetrics(currentMetrics);
      }
    };

    // Initial update
    updateStatus();

    // Update on connection state changes
    const unsubscribe = wsClient.onStateChange(() => {
      updateStatus();
    });

    // Update metrics periodically
    const interval = setInterval(updateStatus, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getTransportIcon = () => {
    if (!isConnected) {
      return <WifiOff className="h-4 w-4" />;
    }

    switch (transportType) {
      case TransportType.Quic:
        return <Zap className="h-4 w-4" />;
      case TransportType.WebSocket:
        return <Wifi className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getTransportLabel = () => {
    if (!isConnected) {
      return 'Disconnected';
    }

    switch (transportType) {
      case TransportType.Quic:
        return 'QUIC';
      case TransportType.WebSocket:
        return 'WebSocket';
      default:
        return 'Unknown';
    }
  };

  const getTransportColor = () => {
    if (!isConnected) {
      return 'text-muted-foreground';
    }

    switch (transportType) {
      case TransportType.Quic:
        return 'text-green-500';
      case TransportType.WebSocket:
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatLatency = (latency: number) => {
    return `${Math.round(latency)}ms`;
  };

  const formatThroughput = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) {
      return `${Math.round(bytesPerSecond)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!showDetails) {
    // Compact view - just icon and label
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('flex items-center justify-center', getTransportColor())}>
          {getTransportIcon()}
        </div>
        <span className={cn('text-sm font-medium', getTransportColor())}>
          {getTransportLabel()}
        </span>
      </div>
    );
  }

  // Detailed view with metrics
  return (
    <div className={cn('space-y-3', className)}>
      {/* Transport Type */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Transport Protocol</span>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center', getTransportColor())}>
            {getTransportIcon()}
          </div>
          <span className={cn('text-sm font-medium', getTransportColor())}>
            {getTransportLabel()}
          </span>
        </div>
      </div>

      {/* Connection Metrics */}
      {isConnected && metrics && (
        <>
          {/* Connection Duration */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Connected For</span>
            <span className="text-sm font-medium text-foreground">
              {formatDuration(metrics.connectionDuration)}
            </span>
          </div>

          {/* Latency */}
          {metrics.averageLatency > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Latency</span>
              <span className="text-sm font-medium text-foreground">
                {formatLatency(metrics.averageLatency)}
                {metrics.lastLatency > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    (last: {formatLatency(metrics.lastLatency)})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Throughput */}
          {metrics.bytesPerSecond > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Throughput</span>
              <span className="text-sm font-medium text-foreground">
                {formatThroughput(metrics.bytesPerSecond)}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Messages</span>
            <span className="text-sm font-medium text-foreground">
              ↑{metrics.messagesSent} ↓{metrics.messagesReceived}
            </span>
          </div>

          {/* Data Transfer */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Data Transfer</span>
            <span className="text-sm font-medium text-foreground">
              ↑{(metrics.bytesSent / 1024).toFixed(1)} KB ↓
              {(metrics.bytesReceived / 1024).toFixed(1)} KB
            </span>
          </div>

          {/* Connection Quality Indicators */}
          {metrics.errorCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Errors</span>
              <span className="text-sm font-medium text-destructive">
                {metrics.errorCount}
              </span>
            </div>
          )}

          {metrics.reconnectCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reconnects</span>
              <span className="text-sm font-medium text-yellow-500">
                {metrics.reconnectCount}
              </span>
            </div>
          )}

          {metrics.fallbackCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">QUIC Fallbacks</span>
              <span className="text-sm font-medium text-yellow-500">
                {metrics.fallbackCount}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
