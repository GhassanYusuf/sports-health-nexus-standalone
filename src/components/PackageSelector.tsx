import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Plus, Sparkles, Calendar, Package, Tag, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CustomPackageBuilder from './CustomPackageBuilder';
import MembershipRegistrationFlow from './MembershipRegistrationFlow';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Activity {
  id: string;
  title: string;
  duration_minutes: number;
  picture_url?: string;
  activity_schedules?: { day_of_week: string; start_time: string; end_time: string }[];
}

interface PackageWithActivities {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  description?: string;
  features?: string[];
  is_popular: boolean;
  activity_type: string;
  gender_restriction?: string;
  popularity?: number;
  picture_url?: string;
  discount_code?: string;
  discount_percentage?: number;
  start_date?: string;
  end_date?: string;
  age_min?: number;
  age_max?: number;
  package_activities?: any[];
}

interface PackageSelectorProps {
  packages: any[];
  clubId?: string;
  currency?: string;
  initialPackageId?: string; // Add this to support auto-opening registration
}

const PackageSelector = ({ packages, clubId, currency = 'USD', initialPackageId }: PackageSelectorProps) => {
  const navigate = useNavigate();
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showRegistrationFlow, setShowRegistrationFlow] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [packagesWithActivities, setPackagesWithActivities] = useState<PackageWithActivities[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [existingChildren, setExistingChildren] = useState<any[]>([]);
  const [clubData, setClubData] = useState<any>(null);
  const [enrolledPackageIds, setEnrolledPackageIds] = useState<string[]>([]);

  // Check for initial package selection from URL
  useEffect(() => {
    if (initialPackageId) {
      // Automatically open registration for the pre-selected package
      setSelectedPackage(initialPackageId);
      setShowRegistrationFlow(true);
    }
  }, [initialPackageId]);

  const formatCurrency = (amount: number) => {
    const hasDecimals = amount % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(amount);
  };

  const handleSelectPackage = async (packageId: string) => {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // User not logged in, show auth dialog
      setSelectedPackage(packageId);
      setShowAuthDialog(true);
    } else {
      // User logged in, fetch their profile and children data
      setSelectedPackage(packageId);

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserProfile(profile);

      // Fetch user's children
      const { data: children } = await supabase
        .from('children')
        .select('*')
        .eq('parent_user_id', user.id);

      setExistingChildren(children || []);

      // Show registration flow
      setShowRegistrationFlow(true);
    }
  };

  const handleSignIn = () => {
    // Store the current club and package selection for return
    const returnUrl = window.location.pathname;
    navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}&packageId=${selectedPackage}`);
  };

  const handleSignUp = () => {
    // Store the current club and package selection for return
    const returnUrl = window.location.pathname;
    navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}&packageId=${selectedPackage}&mode=signup`);
  };

  useEffect(() => {
    fetchPackageActivities();
  }, [packages]);

  // Fetch club data
  useEffect(() => {
    const fetchClubData = async () => {
      if (!clubId) return;

      const { data } = await supabase
        .from('clubs')
        .select('id, name, currency, enrollment_fee, vat_percentage, vat_registration_number')
        .eq('id', clubId)
        .maybeSingle();

      setClubData(data);
    };

    fetchClubData();
  }, [clubId]);

  // Fetch user's enrolled packages to filter them out
  useEffect(() => {
    const fetchUserEnrollments = async () => {
      if (!clubId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all club members for this user and their children
      const { data: members } = await supabase
        .from('club_members')
        .select('id')
        .eq('club_id', clubId)
        .or(`user_id.eq.${user.id},child_id.in.(select id from children where parent_user_id = '${user.id}')`);

      if (!members || members.length === 0) return;

      const memberIds = members.map(m => m.id);

      // Get active enrollments for these members
      const { data: enrollments } = await supabase
        .from('package_enrollments')
        .select('package_id')
        .in('member_id', memberIds)
        .eq('is_active', true);

      if (enrollments) {
        const packageIds = enrollments.map(e => e.package_id);
        setEnrolledPackageIds(packageIds);
      }
    };

    fetchUserEnrollments();
  }, [clubId]);

  const fetchPackageActivities = async () => {
    const enrichedPackages = await Promise.all(
      packages.map(async (pkg) => {
        const { data: packageActivities } = await supabase
          .from('package_activities')
          .select(`
            activity_id,
            class_id,
            instructor_id,
            activities(
              id, 
              title, 
              picture_url,
              duration_minutes,
              activity_schedules(
                day_of_week,
                start_time,
                end_time
              )
            ),
            club_instructors(
              id,
              name,
              image_url
            )
          `)
          .eq('package_id', pkg.id);

        if (packageActivities && packageActivities.length > 0) {
          return {
            ...pkg,
            package_activities: packageActivities
          };
        }

        return {
          ...pkg,
          package_activities: []
        };
      })
    );

    setPackagesWithActivities(enrichedPackages);
  };


  const getDayAbbr = (day: string) => {
    const days: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
      thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
    };
    return days[day.toLowerCase()] || day;
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const groupSchedulesByTime = (schedules: any[]) => {
    const timeGroups: Record<string, string[]> = {};
    const dayOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    
    schedules.forEach(schedule => {
      const timeKey = `${schedule.start_time}-${schedule.end_time}`;
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = [];
      }
      timeGroups[timeKey].push(getDayAbbr(schedule.day_of_week));
    });

    return Object.entries(timeGroups).map(([timeKey, days]) => {
      const [startTime, endTime] = timeKey.split('-');
      const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      return {
        days: sortedDays.join(', '),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime)
      };
    });
  };

  if (showRegistrationFlow) {
    return (
      <MembershipRegistrationFlow
        clubId={clubId || ''}
        packages={packages}
        currency={currency}
        initialPackageId={selectedPackage || undefined}
        existingUserMode={!!userProfile}
        userProfile={userProfile}
        existingChildren={existingChildren}
        hasChildren={existingChildren.length > 0}
        clubData={clubData}
        onComplete={() => {
          setShowRegistrationFlow(false);
          setSelectedPackage(null);
          setUserProfile(null);
          setExistingChildren([]);
        }}
        onCancel={() => {
          setShowRegistrationFlow(false);
          setSelectedPackage(null);
          setUserProfile(null);
          setExistingChildren([]);
        }}
      />
    );
  }

  if (showCustomBuilder) {
    return (
      <CustomPackageBuilder 
        clubId={clubId || ''}
        onBack={() => setShowCustomBuilder(false)}
        currency={currency}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Choose Your Package</h2>
          <p className="text-muted-foreground">Select from our curated packages or create your own</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowCustomBuilder(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Custom Package
          </Button>
          <Button 
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <Sparkles className="w-4 h-4" />
            Consult AI
          </Button>
        </div>
      </div>

      {/* Pre-made Packages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packagesWithActivities.filter(pkg => !enrolledPackageIds.includes(pkg.id)).length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              You're already enrolled in all available packages for this club.
            </p>
          </div>
        ) : (
          packagesWithActivities
            .filter(pkg => !enrolledPackageIds.includes(pkg.id)) // Filter out enrolled packages
            .map((item) => {
          const activityPictures = item.package_activities
            ?.map((pa: any) => pa.activities?.picture_url)
            .filter((url: string) => url);
          
          // Combine package picture (first) with activity pictures
          const allPictures = [
            ...(item.picture_url ? [item.picture_url] : []),
            ...(activityPictures || [])
          ];

          return (
            <Card 
              key={item.id} 
              className={cn(
                "overflow-hidden transition-all hover:shadow-lg flex flex-col",
                item.is_popular && "border-primary border-2"
              )}
            >
              {/* Image Carousel */}
              {allPictures.length > 0 && (
                <div className="relative">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {allPictures.map((picture: string, idx: number) => (
                        <CarouselItem key={idx}>
                          <div className="w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-muted/30">
                            <img
                              src={picture}
                              alt={idx === 0 && item.picture_url ? item.name : `Activity ${idx + 1}`}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {allPictures.length > 1 && (
                      <>
                        <CarouselPrevious className="left-2" />
                        <CarouselNext className="right-2" />
                      </>
                    )}
                  </Carousel>
                  {item.is_popular && (
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-primary text-primary-foreground">
                        ⭐ Popular
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Package Details */}
              <div className="flex-1 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{item.name}</h3>
                    
                    {/* Package Description */}
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant={item.activity_type === "single" ? "secondary" : "default"} className="text-xs font-medium">
                        {item.activity_type === "single" ? "Single Activity" : "Multi-Activity"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {item.gender_restriction === "mixed" ? "Mixed" : 
                         item.gender_restriction === "male" ? "Male" : "Female"}
                      </Badge>
                      {(item.age_min || item.age_max) && (
                        <Badge variant="outline" className="text-xs">
                          {item.age_min || 0}-{item.age_max || "∞"}y
                        </Badge>
                      )}
                      {item.discount_code && (
                        <Badge variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {item.discount_code}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price and Duration */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(item.price)}
                    </span>
                    {item.discount_percentage > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        {item.discount_percentage}% off
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{item.duration_months}mo</span>
                    </div>
                    {item.popularity && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item.popularity}%</span>
                        <span>popular</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Range */}
                {(item.start_date || item.end_date) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <Calendar className="h-3 w-3" />
                    {item.start_date && format(new Date(item.start_date), "MMM dd")}
                    {item.start_date && item.end_date && " - "}
                    {item.end_date && format(new Date(item.end_date), "MMM dd, yyyy")}
                  </div>
                )}

                {/* Included Activities - Always Visible */}
                {item.package_activities && item.package_activities.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4" />
                      <h4 className="text-sm font-semibold">Included Activities ({item.package_activities.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {item.package_activities.map((pa: any, idx: number) => {
                        const activity = pa.activities;
                        const instructor = pa.club_instructors;
                        
                        if (!activity) return null;

                        return (
                          <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex gap-3">
                              {activity.picture_url && (
                                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                                  <img
                                    src={activity.picture_url}
                                    alt={activity.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h5 className="font-semibold text-sm">{activity.title}</h5>
                                  
                                  {/* Trainer Info - Prominent */}
                                  {instructor && (
                                    <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-2 py-1">
                                      <Avatar className="h-5 w-5 border border-primary/20">
                                        <AvatarImage src={instructor.image_url} alt={instructor.name} />
                                        <AvatarFallback className="text-[10px] bg-primary/20">{instructor.name.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-[10px] font-medium text-primary">{instructor.name}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Duration and Schedule on same line */}
                                <div className="flex flex-wrap items-center gap-3">
                                  {activity.duration_minutes && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>{activity.duration_minutes} min</span>
                                    </div>
                                  )}

                                  {activity.activity_schedules && activity.activity_schedules.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Calendar className="h-3 w-3 text-muted-foreground" />
                                      {groupSchedulesByTime(activity.activity_schedules).map((group, sidx) => (
                                        <Badge key={sidx} variant="outline" className="text-[10px] py-0.5 px-2">
                                          {group.days}: {group.startTime} - {group.endTime}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <CardFooter className="pt-0">
                <Button 
                  className="w-full" 
                  onClick={() => handleSelectPackage(item.id)}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
          );
        })
        )}
      </div>

      {/* Auth Required Dialog */}
      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Required</AlertDialogTitle>
            <AlertDialogDescription>
              To enroll in this package, you need to have an account. Please sign in to your existing account or create a new one to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowAuthDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleSignIn} className="w-full sm:w-auto">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
            <AlertDialogAction onClick={handleSignUp} className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Create Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PackageSelector;
