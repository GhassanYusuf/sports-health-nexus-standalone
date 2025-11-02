import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import VirtualTour from "./pages/VirtualTour";
import TrainerProfile from "./pages/TrainerProfile";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Go from "./pages/Go";
import ClubOwnerSignup from "./pages/ClubOwnerSignup";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Affiliations from "./pages/Affiliations";
import MyChildren from "./pages/MyChildren";
import Settings from "./pages/Settings";
import AIAdvisor from "./pages/AIAdvisor";
import ClubDetails from "./pages/ClubDetails";
import DatabaseBackupRestore from "./pages/DatabaseBackupRestore";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
