import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingBackButtonProps {
  fallbackRoute?: string;
  className?: string;
}

export const FloatingBackButton: React.FC<FloatingBackButtonProps> = ({
  fallbackRoute,
  className,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (fallbackRoute) {
      navigate(fallbackRoute);
    }
  };

  return (
    <Button
      onClick={handleClick}
      className={cn(
        "fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 z-40 p-0",
        "bg-gradient-primary",
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="h-6 w-6 text-white" />
    </Button>
  );
};
