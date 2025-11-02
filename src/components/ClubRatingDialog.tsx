import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClubRatingDialogProps {
  clubId: string;
  userId: string | null;
  userName: string;
  onRatingSubmitted?: () => void;
}

export const ClubRatingDialog = ({ clubId, userId, userName, onRatingSubmitted }: ClubRatingDialogProps) => {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [existingReview, setExistingReview] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (userId && open) {
      checkMembershipAndReview();
    }
  }, [userId, clubId, open]);

  const checkMembershipAndReview = async () => {
    if (!userId) return;

    // Check if user is or was a member
    const { data: memberData } = await supabase
      .from("club_members")
      .select("*")
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .maybeSingle();

    setIsMember(!!memberData);

    // Check for existing review
    const { data: reviewData } = await supabase
      .from("club_reviews")
      .select("*")
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .maybeSingle();

    if (reviewData) {
      setExistingReview(reviewData);
      setRating(reviewData.rating);
      setComment(reviewData.comment || "");
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to rate this club",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a rating",
        variant: "destructive",
      });
      return;
    }

    if (!isMember) {
      toast({
        title: "Members only",
        description: "Only current or former members can rate this club",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewData = {
        club_id: clubId,
        user_id: userId,
        rating,
        comment: comment.trim() || "",
        reviewer_name: userName,
      };

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from("club_reviews")
          .update(reviewData)
          .eq("id", existingReview.id);

        if (error) throw error;

        toast({
          title: "Review updated",
          description: "Your review has been updated successfully",
        });
      } else {
        // Create new review
        const { error } = await supabase
          .from("club_reviews")
          .insert(reviewData);

        if (error) throw error;

        toast({
          title: "Review submitted",
          description: "Thank you for rating this club",
        });
      }

      setOpen(false);
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("club_reviews")
        .delete()
        .eq("id", existingReview.id);

      if (error) throw error;

      toast({
        title: "Review deleted",
        description: "Your review has been removed",
      });

      setRating(0);
      setComment("");
      setExistingReview(null);
      setOpen(false);
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId || !isMember) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Star className="w-4 h-4" />
          {existingReview ? "Edit Your Review" : "Rate This Club"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{existingReview ? "Edit Your Review" : "Rate This Club"}</DialogTitle>
          <DialogDescription>
            Share your experience with other members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Review (Optional)</label>
            <Textarea
              placeholder="Tell us about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {comment.length}/500 characters
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existingReview && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              Delete Review
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? "Submitting..." : existingReview ? "Update Review" : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
