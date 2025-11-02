import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Calendar, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExpiringMember {
  member_id: string;
  member_name: string;
  member_avatar: string | null;
  package_name: string;
  enrolled_at: string;
  expiry_date: Date;
  days_remaining: number;
}

interface ExpiringSubscriptionsPanelProps {
  clubId: string;
}

export function ExpiringSubscriptionsPanel({ clubId }: ExpiringSubscriptionsPanelProps) {
  const [expiringMembers, setExpiringMembers] = useState<ExpiringMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpiringSubscriptions();

    // Set up realtime subscription for package enrollments
    const channel = supabase
      .channel('expiring-subscriptions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'package_enrollments',
        },
        () => {
          fetchExpiringSubscriptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  const fetchExpiringSubscriptions = async () => {
    try {
      const { data: enrollments, error } = await supabase
        .from('package_enrollments')
        .select(`
          member_id,
          enrolled_at,
          is_active,
          club_members!inner(
            id,
            name,
            avatar_url,
            club_id
          ),
          club_packages!inner(
            name,
            duration_months
          )
        `)
        .eq('club_members.club_id', clubId)
        .eq('is_active', true);

      if (error) throw error;

      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const expiring: ExpiringMember[] = [];

      enrollments?.forEach((enrollment: any) => {
        const enrolledDate = new Date(enrollment.enrolled_at);
        const durationMonths = enrollment.club_packages.duration_months || 1;
        const expiryDate = new Date(enrolledDate);
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

        // Check if subscription expires within 3 days and hasn't expired yet
        if (expiryDate > now && expiryDate <= threeDaysLater) {
          const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          expiring.push({
            member_id: enrollment.club_members.id,
            member_name: enrollment.club_members.name,
            member_avatar: enrollment.club_members.avatar_url,
            package_name: enrollment.club_packages.name,
            enrolled_at: enrollment.enrolled_at,
            expiry_date: expiryDate,
            days_remaining: daysRemaining
          });
        }
      });

      // Sort by days remaining (soonest first)
      expiring.sort((a, b) => a.days_remaining - b.days_remaining);

      setExpiringMembers(expiring);
    } catch (error) {
      console.error('Error fetching expiring subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Expiring Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (expiringMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-green-500" />
            Expiring Subscriptions
          </CardTitle>
          <CardDescription>Members with subscriptions expiring within 3 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No subscriptions expiring soon</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Expiring Subscriptions
          <Badge variant="destructive" className="ml-auto">
            {expiringMembers.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {expiringMembers.length} member{expiringMembers.length !== 1 ? 's' : ''} with subscriptions expiring within 3 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {expiringMembers.map((member) => (
              <div
                key={member.member_id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  {member.member_avatar ? (
                    <img
                      src={member.member_avatar}
                      alt={member.member_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.member_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{member.package_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={member.days_remaining <= 1 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {member.days_remaining === 0 ? 'Today' : 
                       member.days_remaining === 1 ? 'Tomorrow' :
                       `${member.days_remaining} days`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      expires {formatDistanceToNow(member.expiry_date, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <Button size="sm" variant="outline" className="flex-shrink-0">
                  Send Reminder
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
