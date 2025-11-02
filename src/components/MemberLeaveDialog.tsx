import { useState, useEffect } from "react";
import { Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MemberLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  userId: string;
  onLeaveComplete?: () => void;
}

export const MemberLeaveDialog = ({ 
  open, 
  onOpenChange, 
  clubId, 
  userId,
  onLeaveComplete 
}: MemberLeaveDialogProps) => {
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      fetchMembers();
    }
  }, [open, userId, clubId]);

  const fetchMembers = async () => {
    try {
      // Fetch user's direct membership
      const { data: userMember } = await supabase
        .from("club_members")
        .select("*")
        .eq("club_id", clubId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      // Fetch user's children
      const { data: children } = await supabase
        .from("children")
        .select("*")
        .eq("parent_user_id", userId);

      // Fetch children's memberships
      const childIds = (children || []).map(c => c.id);
      const { data: childMembers } = await supabase
        .from("club_members")
        .select("*")
        .eq("club_id", clubId)
        .in("child_id", childIds)
        .eq("is_active", true);

      // Combine all members
      const allMembers = [];
      
      if (userMember) {
        allMembers.push({
          ...userMember,
          type: "self",
          displayName: userMember.name || "You"
        });
      }

      if (childMembers) {
        for (const childMember of childMembers) {
          const child = children?.find(c => c.id === childMember.child_id);
          allMembers.push({
            ...childMember,
            type: "child",
            displayName: child?.name || childMember.name,
            childInfo: child
          });
        }
      }

      setMembers(allMembers);
      
      // Auto-select if only one member
      if (allMembers.length === 1) {
        setSelectedMemberId(allMembers[0].id);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      toast({
        title: "Error",
        description: "Failed to load member information",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedMemberId) {
      toast({
        title: "Selection required",
        description: "Please select a member to leave",
        variant: "destructive"
      });
      return;
    }

    if (confirmText.toLowerCase() !== "i am sure") {
      toast({
        title: "Confirmation required",
        description: 'Please type "I am sure" to confirm',
        variant: "destructive"
      });
      return;
    }

    if (!leaveReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for leaving",
        variant: "destructive"
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please rate your experience",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the member-leave-club edge function
      const { data, error } = await supabase.functions.invoke("member-leave-club", {
        body: {
          memberId: selectedMemberId,
          leaveReason: leaveReason.trim()
        }
      });

      if (error) throw error;

      // Submit rating
      const selectedMember = members.find(m => m.id === selectedMemberId);
      const reviewData = {
        club_id: clubId,
        user_id: userId,
        rating,
        comment: comment.trim() || "",
        reviewer_name: selectedMember?.displayName || "Member"
      };

      // Check if review already exists
      const { data: existingReview } = await supabase
        .from("club_reviews")
        .select("*")
        .eq("club_id", clubId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingReview) {
        await supabase
          .from("club_reviews")
          .update(reviewData)
          .eq("id", existingReview.id);
      } else {
        await supabase
          .from("club_reviews")
          .insert(reviewData);
      }

      toast({
        title: "Successfully left",
        description: data?.message || "You have left the club successfully",
      });

      // Reset form
      setSelectedMemberId("");
      setConfirmText("");
      setLeaveReason("");
      setRating(0);
      setComment("");
      
      onOpenChange(false);
      onLeaveComplete?.();
    } catch (error: any) {
      console.error("Error leaving club:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to leave club. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Leave Club
          </DialogTitle>
          <DialogDescription>
            This action will remove the selected member from this club
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Member Selection */}
          <div className="space-y-3">
            <Label>Select Member to Leave</Label>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading members...</p>
            ) : (
              <RadioGroup value={selectedMemberId} onValueChange={setSelectedMemberId}>
                {members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value={member.id} id={member.id} />
                    <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        {member.avatar_url && (
                          <img 
                            src={member.avatar_url} 
                            alt={member.displayName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.type === "self" ? "Your membership" : "Child member"} • {member.rank}
                          </p>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* Leave Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Leaving *</Label>
            <Textarea
              id="reason"
              placeholder="Please tell us why you're leaving..."
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {leaveReason.length}/500 characters
            </p>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rate Your Experience *</Label>
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

          {/* Optional Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Additional Comments (Optional)</Label>
            <Textarea
              id="comment"
              placeholder="Share more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {comment.length}/500 characters
            </p>
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm">Type "I am sure" to confirm *</Label>
            <Input
              id="confirm"
              placeholder="I am sure"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={confirmText.toLowerCase() === "i am sure" ? "border-green-500" : ""}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedMemberId || confirmText.toLowerCase() !== "i am sure" || !leaveReason.trim() || rating === 0}
          >
            {isSubmitting ? "Processing..." : "Leave Club"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
