/**
 * Transport Manager Metrics Example
 * 
 * This file demonstrates how to use the performance metrics tracking
 * in the TransportManager.
 * 
 * Requirements: 5.5 - Monitor transport performance metrics
 */

import { TransportManager, DEFAULT_TRANSPORT_CONFIG, PerformanceMetrics } from '../transport-manager';

/**
 * Example: Basic metrics monitoring
 */
export async function exampleBasicMetrics() {
  console.log('=== Basic Metrics Example ===');
  
  const manager = new TransportManager(DEFAULT_TRANSPORT_CONFIG);
  
  // Subscribe to metrics updates
  manager.on('metricsUpdate', (metrics: PerformanceMetrics) => {
    console.log('Metrics Update:', {
      transportType: metrics.transportType,
      connectionState: metrics.connectionState,
      connectionDuration: `${(metrics.connectionDuration / 1000).toFixed(2)}s`,
      messagesSent: metrics.messagesSent,
      messagesReceived: metrics.messagesReceived,
      bytesSent: metrics.bytesSent,
      bytesReceived: metrics.bytesReceived,
      messagesPerSecond: metrics.messagesPerSecond.toFixed(2),
      bytesPerSecond: metrics.bytesPerSecond.toFixed(2),
      averageLatency: `${metrics.averageLatency.toFixed(2)}ms`,
      reconnectCount: metrics.reconnectCount,
      errorCount: metrics.errorCount,
      fallbackCount: metrics.fallbackCount,
    });
  });
  
  try {
    // Connect
    await manager.connect();
    
    // Get current metrics
    const metrics = manager.getMetrics();
    console.log('Current Metrics:', metrics);
    
    // Simulate sending messages
    const encoder = new TextEncoder();
    for (let i = 0; i < 10; i++) {
      const message = encoder.encode(JSON.stringify({ 
        type: 'test', 
        content: `Message ${i}` 
      }));
      await manager.send(message.buffer);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Get updated metrics
    const updatedMetrics = manager.getMetrics();
    console.log('Updated Metrics:', updatedMetrics);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

/**
 * Example: Throughput monitoring
 */
export async function exampleThroughputMonitoring() {
  console.log('=== Throughput Monitoring Example ===');
  
  const manager = new TransportManager(DEFAULT_TRANSPORT_CONFIG);
  
  // Track throughput over time
  const throughputHistory: Array<{ time: number; mps: number; bps: number }> = [];
  
  manager.on('metricsUpdate', (metrics: PerformanceMetrics) => {
    throughputHistory.push({
      time: Date.now(),
      mps: metrics.messagesPerSecond,
      bps: metrics.bytesPerSecond,
    });
    
    console.log(`Throughput: ${metrics.messagesPerSecond.toFixed(2)} msg/s, ${(metrics.bytesPerSecond / 1024).toFixed(2)} KB/s`);
  });
  
  try {
    await manager.connect();
    
    // Send burst of messages
    const encoder = new TextEncoder();
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      const message = encoder.encode(JSON.stringify({ 
        type: 'test', 
        content: `Burst message ${i}`,
        timestamp: Date.now(),
      }));
      await manager.send(message.buffer);
    }
    
    const duration = Date.now() - startTime;
    console.log(`Sent 100 messages in ${duration}ms`);
    
    // Wait for metrics to update
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Analyze throughput
    console.log('Throughput History:', throughputHistory);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

/**
 * Example: Latency monitoring
 */
export async function exampleLatencyMonitoring() {
  console.log('=== Latency Monitoring Example ===');
  
  const manager = new TransportManager(DEFAULT_TRANSPORT_CONFIG);
  
  manager.on('metricsUpdate', (metrics: PerformanceMetrics) => {
    if (metrics.averageLatency > 0) {
      console.log('Latency Stats:', {
        average: `${metrics.averageLatency.toFixed(2)}ms`,
        min: `${metrics.minLatency.toFixed(2)}ms`,
        max: `${metrics.maxLatency.toFixed(2)}ms`,
        last: `${metrics.lastLatency.toFixed(2)}ms`,
      });
    }
  });
  
  try {
    await manager.connect();
    
    // Send messages with IDs for latency tracking
    const encoder = new TextEncoder();
    
    for (let i = 0; i < 10; i++) {
      const messageId = `msg_${i}`;
      const message = encoder.encode(JSON.stringify({ 
        id: messageId,
        type: 'ping',
        timestamp: Date.now(),
      }));
      
      await manager.send(message.buffer, messageId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Wait for metrics to update
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const metrics = manager.getMetrics();
    console.log('Final Latency Metrics:', {
      average: metrics.averageLatency,
      min: metrics.minLatency,
      max: metrics.maxLatency,
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

/**
 * Example: Connection quality monitoring
 */
export async function exampleConnectionQuality() {
  console.log('=== Connection Quality Example ===');
  
  const manager = new TransportManager(DEFAULT_TRANSPORT_CONFIG);
  
  manager.on('metricsUpdate', (metrics: PerformanceMetrics) => {
    const quality = calculateConnectionQuality(metrics);
    console.log('Connection Quality:', {
      score: quality.score,
      rating: quality.rating,
      factors: quality.factors,
    });
  });
  
  try {
    await manager.connect();
    
    // Monitor for a period
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

/**
 * Calculate connection quality score
 */
function calculateConnectionQuality(metrics: PerformanceMetrics): {
  score: number;
  rating: string;
  factors: Record<string, string>;
} {
  let score = 100;
  const factors: Record<string, string> = {};
  
  // Latency factor (0-30 points)
  if (metrics.averageLatency > 0) {
    if (metrics.averageLatency < 50) {
      factors.latency = 'Excellent';
    } else if (metrics.averageLatency < 100) {
      score -= 10;
      factors.latency = 'Good';
    } else if (metrics.averageLatency < 200) {
      score -= 20;
      factors.latency = 'Fair';
    } else {
      score -= 30;
      factors.latency = 'Poor';
    }
  }
  
  // Error rate factor (0-30 points)
  const totalMessages = metrics.messagesSent + metrics.messagesReceived;
  if (totalMessages > 0) {
    const errorRate = metrics.errorCount / totalMessages;
    if (errorRate < 0.01) {
      factors.errors = 'Excellent';
    } else if (errorRate < 0.05) {
      score -= 10;
      factors.errors = 'Good';
    } else if (errorRate < 0.1) {
      score -= 20;
      factors.errors = 'Fair';
    } else {
      score -= 30;
      factors.errors = 'Poor';
    }
  }
  
  // Reconnection factor (0-20 points)
  if (metrics.reconnectCount === 0) {
    factors.stability = 'Excellent';
  } else if (metrics.reconnectCount < 3) {
    score -= 10;
    factors.stability = 'Good';
  } else {
    score -= 20;
    factors.stability = 'Poor';
  }
  
  // Transport type factor (0-20 points)
  if (metrics.transportType === 'quic') {
    factors.transport = 'QUIC (Optimal)';
  } else if (metrics.transportType === 'websocket') {
    score -= 10;
    factors.transport = 'WebSocket (Fallback)';
  } else {
    score -= 20;
    factors.transport = 'Unknown';
  }
  
  // Determine rating
  let rating: string;
  if (score >= 90) {
    rating = 'Excellent';
  } else if (score >= 70) {
    rating = 'Good';
  } else if (score >= 50) {
    rating = 'Fair';
  } else {
    rating = 'Poor';
  }
  
  return { score, rating, factors };
}

/**
 * Example: Reset metrics
 */
export async function exampleResetMetrics() {
  console.log('=== Reset Metrics Example ===');
  
  const manager = new TransportManager(DEFAULT_TRANSPORT_CONFIG);
  
  try {
    await manager.connect();
    
    // Send some messages
    const encoder = new TextEncoder();
    for (let i = 0; i < 5; i++) {
      const message = encoder.encode(JSON.stringify({ type: 'test', content: `Message ${i}` }));
      await manager.send(message.buffer);
    }
    
    console.log('Metrics before reset:', manager.getMetrics());
    
    // Reset metrics
    manager.resetMetrics();
    
    console.log('Metrics after reset:', manager.getMetrics());
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

// Export all examples
export const examples = {
  basicMetrics: exampleBasicMetrics,
  throughputMonitoring: exampleThroughputMonitoring,
  latencyMonitoring: exampleLatencyMonitoring,
  connectionQuality: exampleConnectionQuality,
  resetMetrics: exampleResetMetrics,
};
