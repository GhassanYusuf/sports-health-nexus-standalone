import { MessagingPanel } from "@/components/MessagingPanel";
import { MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingBackButton } from "@/components/ui/floating-back-button";

export default function Messages() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />
      <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Messages
        </h1>
        <p className="text-muted-foreground">
          Chat with your clubs and stay connected
        </p>
      </div>

      <MessagingPanel />
      </div>
    </div>
  );
}
