import { useNavigate } from "react-router-dom";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import takeOneLogo from "@/assets/takeone-logo.png";

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <img 
          src={takeOneLogo} 
          alt="TAKEONE" 
          className="h-8 w-auto cursor-pointer"
          onClick={() => navigate("/")}
        />
        <UserProfileMenu />
      </div>
    </header>
  );
}
