import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DeleteClubDialogProps {
  clubId: string;
  clubName: string;
  onClubDeleted?: () => void;
}

export const DeleteClubDialog: React.FC<DeleteClubDialogProps> = ({ clubId, clubName, onClubDeleted }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmName !== clubName) {
      toast({
        title: "Club name doesn't match",
        description: "Please type the exact club name to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Call the edge function to delete club and all related data
      const { data, error } = await supabase.functions.invoke('delete-club', {
        body: { clubId, clubName }
      });

      if (error) throw error;

      toast({
        title: "Club deleted successfully",
        description: "All club data and files have been permanently deleted.",
      });

      // Redirect to admin dashboard and trigger callback
      navigate('/admin');
      onClubDeleted?.();
    } catch (error: any) {
      console.error('Error deleting club:', error);
      toast({
        title: "Error deleting club",
        description: error.message || "An error occurred while deleting the club.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
      setConfirmName("");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full sm:w-auto">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Club
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Delete Club Permanently?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 text-left pt-4">
            <p className="text-foreground font-medium">
              This action cannot be undone. This will permanently delete:
            </p>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>All club information and settings</li>
              <li>All facilities and their data</li>
              <li>All instructors and activities</li>
              <li>All packages and memberships</li>
              <li>All uploaded images and files</li>
              <li>All reviews and statistics</li>
            </ul>
            <div className="pt-4 border-t">
              <Label htmlFor="confirm-name" className="text-foreground">
                Type <span className="font-bold text-destructive">{clubName}</span> to confirm:
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Enter club name"
                className="mt-2"
                disabled={isDeleting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmName !== clubName || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
        