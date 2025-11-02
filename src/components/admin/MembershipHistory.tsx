import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Award, Building2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MembershipHistoryProps {
  userId?: string;
  clubId?: string;
}

interface HistoryRecord {
  id: string;
  member_name: string;
  club_id: string;
  joined_date: string;
  left_date: string;
  duration_days: number;
  leave_reason: string | null;
  created_at: string;
  clubs?: {
    name: string;
    logo_url: string | null;
  };
  skills: Array<{
    skill_name: string;
    skill_category: string | null;
  }>;
}

export function MembershipHistory({ userId, clubId }: MembershipHistoryProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [userId, clubId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("membership_history")
        .select(`
          *,
          clubs:club_id (
            name,
            logo_url
          )
        `)
        .order("left_date", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }
      
      if (clubId) {
        query = query.eq("club_id", clubId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch skills for each history record
      const historyWithSkills = await Promise.all(
        (data || []).map(async (record) => {
          const { data: skills } = await supabase
            .from("member_acquired_skills")
            .select("skill_name, skill_category")
            .eq("membership_history_id", record.id);

          return {
            ...record,
            skills: skills || [],
          };
        })
      );

      setHistory(historyWithSkills);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (days: number) => {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;

    const parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays} day${remainingDays > 1 ? "s" : ""}`);

    return parts.join(", ");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading history...
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No membership history found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Membership History</CardTitle>
        <CardDescription>
          Past club memberships and acquired skills
        </CardDescription>
      </CardHeader>
      
      {history.map((record) => (
        <Card key={record.id} className="overflow-hidden border-2">
          <CardContent className="p-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-background">
                  <AvatarImage src={record.clubs?.logo_url || undefined} />
                  <AvatarFallback className="bg-primary/20">
                    <Building2 className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-bold text-lg">
                    {record.clubs?.name || "Unknown Club"}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {record.member_name}
                  </div>
                </div>
                <Badge variant="secondary" className="font-medium">
                  Past Member
                </Badge>
              </div>
            </div>

            {/* Dates */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined
                  </div>
                  <div className="font-semibold">
                    {new Date(record.joined_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Left
                  </div>
                  <div className="font-semibold">
                    {new Date(record.left_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">Duration:</span>
                <span className="text-muted-foreground">
                  {formatDuration(record.duration_days)}
                </span>
              </div>

              {record.leave_reason && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Leave Reason
                  </div>
                  <div className="text-sm">{record.leave_reason}</div>
                </div>
              )}

              {/* Skills */}
              {record.skills.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Award className="h-4 w-4 text-primary" />
                    <span>Skills Acquired ({record.skills.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {record.skills.map((skill, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="font-normal"
                      >
                        {skill.skill_name}
                        {skill.skill_category && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({skill.skill_category})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
