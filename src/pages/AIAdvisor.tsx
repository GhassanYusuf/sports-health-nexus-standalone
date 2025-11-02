import AIAdvisorChat from "@/components/AIAdvisorChat";
import { AppHeader } from "@/components/AppHeader";
import { FloatingBackButton } from "@/components/ui/floating-back-button";

const AIAdvisor = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <AIAdvisorChat />
      </div>
    </div>
  );
};

export default AIAdvisor;
