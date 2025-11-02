import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Component to clean up duplicate instructor records
 * This runs once on mount to remove any duplicate instructors
 */
export const CleanupDuplicateInstructor = () => {
  useEffect(() => {
    const cleanupDuplicate = async () => {
      // Delete the older duplicate instructor for "Master Sami Ali Al Manea"
      // ID: 5c87976a-6e55-42ae-b23e-4172cbcbcfd2
      const { error } = await supabase
        .from("club_instructors")
        .delete()
        .eq("id", "5c87976a-6e55-42ae-b23e-4172cbcbcfd2");
      
      if (error) {
        console.error("Error cleaning up duplicate instructor:", error);
      } else {
        console.log("Successfully cleaned up duplicate instructor");
      }
    };

    cleanupDuplicate();
  }, []);

  return null; // This component doesn't render anything
};
