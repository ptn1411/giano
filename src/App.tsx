import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { wsClient, setupCallEventHandlers } from "@/services/websocket";
import { IncomingCallNotification } from "@/components/chat/IncomingCallNotification";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import TelegramDemo from "./pages/TelegramDemo";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Theme initializer component
function ThemeInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useThemeStore.getState().initializeTheme();
  }, []);

  return <>{children}</>;
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isInitialized } = useAuthStore();
  
  // Connect WebSocket when user is authenticated
  useWebSocket();

  useEffect(() => {
    if (!useAuthStore.getState().isInitialized) {
      void useAuthStore.getState().initialize();
    }
  }, []);

  // Initialize call event listeners when WebSocket connects
  // Requirement 2.1: Handle incoming call notifications
  useEffect(() => {
    if (!session) return;

    // Setup call event handlers
    let cleanupCallHandlers: (() => void) | null = null;

    // Listen for WebSocket connection state changes
    const unsubscribeState = wsClient.onStateChange((state) => {
      if (state === 'connected') {
        // Setup call event handlers when connected
        cleanupCallHandlers = setupCallEventHandlers();
        console.log('[App] Call event handlers initialized');
      } else if (state === 'disconnected') {
        // Cleanup handlers when disconnected
        if (cleanupCallHandlers) {
          cleanupCallHandlers();
          cleanupCallHandlers = null;
        }
      }
    });

    // If already connected, setup handlers immediately
    if (wsClient.isConnected()) {
      cleanupCallHandlers = setupCallEventHandlers();
      console.log('[App] Call event handlers initialized (already connected)');
    }

    return () => {
      unsubscribeState();
      if (cleanupCallHandlers) {
        cleanupCallHandlers();
      }
    };
  }, [session]);

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      {/* Global incoming call notification - Requirement 2.1 */}
      <IncomingCallNotification />
      {children}
    </>
  );
}

// Public route wrapper (redirects to home if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!useAuthStore.getState().isInitialized) {
      void useAuthStore.getState().initialize();
    }
  }, []);

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeInitializer>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route
                path="/auth"
                element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Index />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Settings />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="/telegram-demo" element={<TelegramDemo />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </ThemeInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
