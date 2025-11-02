import { useState, useEffect } from "react";
import { Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MemberLeaveDialog } from "./MemberLeaveDialog";

interface ManageMembershipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  clubName: string;
  userId: string;
  onMembershipChange?: () => void;
  onStartRegistration?: (selectedMembers: MembershipStatus[]) => void;
}

interface MembershipStatus {
  id?: string;
  type: "self" | "child";
  name: string;
  avatarUrl?: string;
  isMember: boolean;
  rank?: string;
  childId?: string;
  childData?: any;
}

export const ManageMembershipsDialog = ({ 
  open, 
  onOpenChange, 
  clubId,
  clubName,
  userId,
  onMembershipChange,
  onStartRegistration
}: ManageMembershipsDialogProps) => {
  const [memberships, setMemberships] = useState<MembershipStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (!userId) {
        toast({
          title: "Authentication required",
          description: "Please sign in to join a club",
          variant: "destructive"
        });
        onOpenChange(false);
        return;
      }
      fetchMemberships();
    }
  }, [open, userId, clubId]);

  const fetchMemberships = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      setUserProfile(profile);

      // Check user's own membership
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

      const allMemberships: MembershipStatus[] = [];

      // Add user's own membership status
      allMemberships.push({
        id: userMember?.id,
        type: "self",
        name: profile?.name || "You",
        avatarUrl: profile?.avatar_url,
        isMember: !!userMember,
        rank: userMember?.rank
      });

      // Add children membership statuses
      if (children) {
        for (const child of children) {
          const { data: childMember } = await supabase
            .from("club_members")
            .select("*")
            .eq("club_id", clubId)
            .eq("child_id", child.id)
            .eq("is_active", true)
            .maybeSingle();

          allMemberships.push({
            id: childMember?.id,
            type: "child",
            name: child.name,
            avatarUrl: child.avatar_url,
            isMember: !!childMember,
            rank: childMember?.rank,
            childId: child.id,
            childData: child
          });
        }
      }

      setMemberships(allMemberships);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      toast({
        title: "Error",
        description: "Failed to load membership information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (membership: MembershipStatus, index: number) => {
    const memberId = `${membership.type}-${index}`;
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleContinueToRegistration = () => {
    const selected = memberships.filter((_, index) => 
      selectedMembers.includes(`${memberships[index].type}-${index}`) && !memberships[index].isMember
    );

    if (selected.length === 0) {
      toast({
        title: "No members selected",
        description: "Please select at least one member to register",
        variant: "destructive"
      });
      return;
    }

    onStartRegistration?.(selected);
    onOpenChange(false);
  };

  const handleLeave = () => {
    setLeaveDialogOpen(true);
  };

  const memberCount = memberships.filter(m => m.isMember).length;
  const totalCount = memberships.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Memberships
            </DialogTitle>
            <DialogDescription>
              View and manage all memberships for {clubName}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Summary Badge */}
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Active Memberships</p>
                  <p className="text-2xl font-bold">{memberCount} / {totalCount}</p>
                </div>
                <Badge variant={memberCount > 0 ? "default" : "secondary"} className="text-lg px-4 py-2">
                  {memberCount > 0 ? "Active" : "No Members"}
                </Badge>
              </div>

              {/* Membership Cards */}
              <div className="space-y-3">
                {memberships.map((membership, index) => {
                  const memberId = `${membership.type}-${index}`;
                  const isSelected = selectedMembers.includes(memberId);
                  
                  return (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Checkbox for non-members */}
                          {!membership.isMember && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleMemberSelection(membership, index)}
                            />
                          )}
                          
                          {/* Avatar */}
                          <div className="relative">
                            {membership.avatarUrl ? (
                              <img 
                                src={membership.avatarUrl} 
                                alt={membership.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-lg font-semibold text-primary">
                                  {membership.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {membership.isMember && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{membership.name}</p>
                              {membership.type === "self" && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                              {membership.type === "child" && (
                                <Badge variant="outline" className="text-xs">Child</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {membership.isMember ? (
                                <span className="text-green-600 font-medium">
                                  Active Member {membership.rank && `• ${membership.rank}`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not a member</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div>
                          {membership.isMember && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleLeave}
                            >
                              <UserMinus className="w-4 h-4 mr-1" />
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Continue Button */}
              {selectedMembers.length > 0 && (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleContinueToRegistration}
                >
                  Continue to Registration ({selectedMembers.length} selected)
                </Button>
              )}

              {memberships.filter(m => !m.isMember).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">All members are already enrolled!</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <MemberLeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        clubId={clubId}
        userId={userId}
        onLeaveComplete={() => {
          fetchMemberships();
          onMembershipChange?.();
        }}
      />
    </>
  );
};
