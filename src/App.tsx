import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWebSocket } from "@/hooks/useWebSocket";
import { setupCallEventHandlers, wsClient } from "@/services/websocket";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import InvitePage from "./pages/InvitePage";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import TelegramDemo from "./pages/TelegramDemo";

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

    // Setup call event handlers once - they persist across reconnections
    // The wsClient.on() method adds handlers to a Map that persists across disconnect/reconnect
    const cleanupCallHandlers = setupCallEventHandlers();
    console.log("[App] Call event handlers initialized");

    // Log connection state changes for debugging
    const unsubscribeState = wsClient.onStateChange((state) => {
      console.log("[App] WebSocket state changed:", state);
    });

    return () => {
      unsubscribeState();
      cleanupCallHandlers();
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

  return <>{children}</>;
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
              <Route path="/invite/:code" element={<InvitePage />} />
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
