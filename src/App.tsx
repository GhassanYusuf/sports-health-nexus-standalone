import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eagerly load critical routes
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load non-critical routes for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Go = lazy(() => import("./pages/Go"));
const ClubOwnerSignup = lazy(() => import("./pages/ClubOwnerSignup"));
const Explore = lazy(() => import("./pages/Explore"));
const Profile = lazy(() => import("./pages/Profile"));
const Affiliations = lazy(() => import("./pages/Affiliations"));
const MyChildren = lazy(() => import("./pages/MyChildren"));
const Settings = lazy(() => import("./pages/Settings"));
const AIAdvisor = lazy(() => import("./pages/AIAdvisor"));
const ClubDetails = lazy(() => import("./pages/ClubDetails"));
const VirtualTour = lazy(() => import("./pages/VirtualTour"));
const TrainerProfile = lazy(() => import("./pages/TrainerProfile"));
const DatabaseBackupRestore = lazy(() => import("./pages/DatabaseBackupRestore"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const ReceiptPreviewTest = lazy(() => import("./pages/ReceiptPreviewTest"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// Configure React Query with aggressive caching for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes (reduces redundant API calls)
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed queries once
      retry: 1,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: 'always',
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/affiliations" element={<Affiliations />} />
            <Route path="/my-children" element={<MyChildren />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/ai-advisor" element={<AIAdvisor />} />
            <Route path="/virtual-tour" element={<VirtualTour />} />
            <Route path="/trainer/:trainerId" element={<TrainerProfile />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/go" element={<Go />} />
            <Route path="/club/:countryISO/:clubSlug" element={<ClubDetails />} />
            <Route path="/club-owner-signup" element={<ClubOwnerSignup />} />
            <Route path="/database-backup-restore" element={<DatabaseBackupRestore />} />
            <Route path="/receipt-preview-test" element={<ReceiptPreviewTest />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

export default App;
