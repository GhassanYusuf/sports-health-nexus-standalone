import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Loader2, Award, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { MembershipHistory } from "@/components/admin/MembershipHistory";

export default function Affiliations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeMemberships, setActiveMemberships] = useState<any[]>([]);
  const [childrenMemberships, setChildrenMemberships] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchAffiliations();
  }, []);

  const fetchAffiliations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    setUserId(user.id);

    // Fetch parent's own active memberships
    const { data: members } = await supabase
      .from('club_members')
      .select(`
        *,
        club:clubs(name, logo_url, location, country_iso, club_slug),
        package_enrollments(
          package:club_packages(
            name,
            price,
            duration_months,
            package_activities(
              activity:activities(title)
            )
          )
        ),
        profiles!club_members_user_id_fkey(
          date_of_birth,
          gender,
          name
        )
      `)
      .eq('user_id', user.id)
      .is('child_id', null)
      .eq('is_active', true);

    if (members) {
      setActiveMemberships(members);
    }

    // Fetch children's active memberships
    const { data: children } = await supabase
      .from('children')
      .select('id')
      .eq('parent_user_id', user.id);

    if (children && children.length > 0) {
      const childIds = children.map(child => child.id);

      const { data: childMemberships } = await supabase
        .from('club_members')
        .select(`
          *,
          club:clubs(name, logo_url, location, country_iso, club_slug),
          package_enrollments(
            package:club_packages(
              name,
              price,
              duration_months,
              package_activities(
                activity:activities(title)
              )
            )
          ),
          child:children(
            name,
            date_of_birth,
            gender
          )
        `)
        .in('child_id', childIds)
        .eq('is_active', true);

      if (childMemberships) {
        setChildrenMemberships(childMemberships);
      }
    }

    setLoading(false);
  };

  const calculateAge = (dateOfBirth: string): number => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculateDuration = (joinedDate: string) => {
    const joined = new Date(joinedDate);
    const today = new Date();
    
    let years = today.getFullYear() - joined.getFullYear();
    let months = today.getMonth() - joined.getMonth();
    let days = today.getDate() - joined.getDate();
    
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    return { years, months, days };
  };

  const extractSkills = (membership: any): string[] => {
    const skills = new Set<string>();
    
    membership.package_enrollments?.forEach((enrollment: any) => {
      enrollment.package?.package_activities?.forEach((pa: any) => {
        if (pa.activity?.title) {
          const sportName = pa.activity.title.split(' - ')[0];
          skills.add(sportName);
        }
      });
    });
    
    return Array.from(skills);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Affiliations</h1>
          <p className="text-muted-foreground">
            View your active and past club memberships
          </p>
        </div>

        {/* Parent's Active Memberships */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-red" />
            My Active Memberships
          </h2>
          {activeMemberships.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Active Memberships</h3>
                <p className="text-muted-foreground mb-6">
                  Join a club to start your fitness journey
                </p>
                <Button onClick={() => navigate("/explore")}>
                  Explore Clubs
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {activeMemberships.map((membership: any) => (
                <Card 
                  key={membership.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    const countryISO = membership.club?.country_iso || 'ae';
                    const slug = membership.club?.club_slug;
                    if (slug) {
                      navigate(`/club/${countryISO.toLowerCase()}/${slug}`);
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {membership.club?.logo_url && (
                          <img 
                            src={membership.club.logo_url} 
                            alt={membership.club.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <CardTitle className="text-xl">{membership.club?.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{membership.club?.location}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-500">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Age Information */}
                    {membership.user?.date_of_birth && (
                      <div className="grid grid-cols-2 gap-3 pb-3 border-b">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Age When Joined
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {calculateAge(membership.user.date_of_birth) - 
                             Math.floor((Date.now() - new Date(membership.joined_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Current Age
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {calculateAge(membership.user.date_of_birth)} years
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Membership Duration */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Time as Member
                      </div>
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                        {(() => {
                          const duration = calculateDuration(membership.joined_date);
                          const parts = [];
                          if (duration.years > 0) parts.push(`${duration.years}y`);
                          if (duration.months > 0) parts.push(`${duration.months}m`);
                          if (duration.days > 0 || parts.length === 0) parts.push(`${duration.days}d`);
                          return (
                            <span className="font-semibold text-foreground">
                              {parts.join(' ')}
                            </span>
                          );
                        })()}
                        <span className="text-muted-foreground ml-1">
                          (since {new Date(membership.joined_date).toLocaleDateString()})
                        </span>
                      </div>
                    </div>

                    {/* Skills/Sports */}
                    {(() => {
                      const skills = extractSkills(membership);
                      return skills.length > 0 ? (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            Currently Training In
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill, index) => (
                              <Badge 
                                key={index}
                                variant="secondary"
                                className="font-medium bg-primary/10 text-primary hover:bg-primary/20"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Children's Active Memberships */}
        {childrenMemberships.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-6 w-6 text-brand-red" />
              Children's Active Memberships
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {childrenMemberships.map((membership: any) => (
                <Card
                  key={membership.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                  onClick={() => {
                    const countryISO = membership.club?.country_iso || 'ae';
                    const slug = membership.club?.club_slug;
                    if (slug) {
                      navigate(`/club/${countryISO.toLowerCase()}/${slug}`);
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {membership.club?.logo_url && (
                          <img
                            src={membership.club.logo_url}
                            alt={membership.club.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <CardTitle className="text-xl">{membership.club?.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{membership.club?.location}</p>
                          {membership.child?.name && (
                            <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                              {membership.child.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-green-500">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Child Age Information */}
                    {membership.child?.date_of_birth && (
                      <div className="grid grid-cols-2 gap-3 pb-3 border-b">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Age When Joined
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {calculateAge(membership.child.date_of_birth) -
                             Math.floor((Date.now() - new Date(membership.joined_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Current Age
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {calculateAge(membership.child.date_of_birth)} years
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Membership Duration */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Time as Member
                      </div>
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                        {(() => {
                          const duration = calculateDuration(membership.joined_date);
                          const parts = [];
                          if (duration.years > 0) parts.push(`${duration.years}y`);
                          if (duration.months > 0) parts.push(`${duration.months}m`);
                          if (duration.days > 0 || parts.length === 0) parts.push(`${duration.days}d`);
                          return (
                            <span className="font-semibold text-foreground">
                              {parts.join(' ')}
                            </span>
                          );
                        })()}
                        <span className="text-muted-foreground ml-1">
                          (since {new Date(membership.joined_date).toLocaleDateString()})
                        </span>
                      </div>
                    </div>

                    {/* Enrolled Packages */}
                    {membership.package_enrollments && membership.package_enrollments.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          Enrolled Packages ({membership.package_enrollments.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {membership.package_enrollments.map((enrollment: any, index: number) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              {enrollment.package?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills/Sports */}
                    {(() => {
                      const skills = extractSkills(membership);
                      return skills.length > 0 ? (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            Currently Training In
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="font-medium bg-primary/10 text-primary hover:bg-primary/20"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Membership History */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-brand-red" />
            Membership History
          </h2>
          {userId && <MembershipHistory userId={userId} />}
        </div>
      </div>
    </div>
  );
}
