import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, MapPin, Phone, Mail, Globe, Users, 
  Package, User, Clock, DollarSign, Calendar, Award, Image as ImageIcon,
  Loader2, Heart, MessageCircle, TrendingUp, Dumbbell, ShoppingBag, CalendarDays, BarChart3,
  Gift, Building2, Sparkles, ExternalLink
} from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppHeader } from "@/components/AppHeader";
import { PartnerBenefitsModal } from "@/components/PartnerBenefitsModal";
import { ReviewsModal } from "@/components/ReviewsModal";
import { BannerCarousel } from "@/components/BannerCarousel";
import { ClubAboutCard } from "@/components/ClubAboutCard";
import PackageSelector from "@/components/PackageSelector";

interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  image_url: string;
  logo_url: string;
  rating: number;
  club_email: string;
  club_phone: string;
  club_phone_code: string;
  slogan: string;
  slogan_explanation: string;
  peak_hours: string;
  gps_latitude: number;
  gps_longitude: number;
  link_tree: any;
  owner_contact: string;
  owner_name: string;
  currency: string;
}

interface Facility {
  id: string;
  name: string;
  description: string;
  is_available: boolean;
  pictures: FacilityPicture[];
  operating_hours: OperatingHour[];
}

interface FacilityPicture {
  id: string;
  image_url: string;
}

interface OperatingHour {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_months: number;
  picture_url: string;
  popularity: number;
}

interface Instructor {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  image_url: string;
  rating: number;
  offers_personal_training: boolean;
  member_id: string;
  gender?: string;
}

interface Partner {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  discount_text: string;
  category: string;
  terms: string;
  requirements: string;
  contact_info: any;
}

interface OpeningHour {
  day_of_week: string;
  earliest_open: string;
  latest_close: string;
}

interface TodayActivity {
  id: string;
  activity_title: string;
  activity_description: string | null;
  activity_picture: string | null;
  schedule_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  package_name: string;
  status: 'ended' | 'running' | 'upcoming';
  minutesUntilStart?: number;
}

// Helper to check if string is a valid UUID
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Helper to get border color based on instructor gender
const getInstructorBorderColor = (gender?: string) => {
  if (!gender) return 'border-primary/20';
  
  const lowerGender = gender.toLowerCase();
  if (lowerGender === 'female') return 'border-pink-500';
  if (lowerGender === 'male') return 'border-blue-500';
  return 'border-primary/20';
};

const ClubDetails = () => {
  const { clubId, countryISO, clubSlug } = useParams<{ 
    clubId?: string; 
    countryISO?: string; 
    clubSlug?: string; 
  }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMembers, setActiveMembers] = useState(0);
  const [instructorRatings, setInstructorRatings] = useState<Record<string, number>>({});
  const [isActiveMember, setIsActiveMember] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [clubPictures, setClubPictures] = useState<{ image_url: string; description?: string }[]>([]);
  const [todaysActivities, setTodaysActivities] = useState<TodayActivity[]>([]);

  useEffect(() => {
    if (countryISO && clubSlug) {
      fetchClubDetails();
      checkMembershipStatus();
    }
  }, [countryISO, clubSlug]);

  // Auto-refresh activity statuses every minute
  useEffect(() => {
    if (todaysActivities.length === 0) return;

    const interval = setInterval(() => {
      setTodaysActivities(prev => 
        prev.map(activity => {
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();
          
          const [startHour, startMin] = activity.start_time.split(':').map(Number);
          const [endHour, endMin] = activity.end_time.split(':').map(Number);
          
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          let status: 'ended' | 'running' | 'upcoming';
          let minutesUntilStart: number | undefined;
          
          if (currentTime >= endMinutes) {
            status = 'ended';
          } else if (currentTime >= startMinutes && currentTime < endMinutes) {
            status = 'running';
          } else {
            status = 'upcoming';
            minutesUntilStart = startMinutes - currentTime;
          }
          
          return { ...activity, status, minutesUntilStart };
        })
      );
    }, 60000); // Every 60 seconds
    
    return () => clearInterval(interval);
  }, [todaysActivities.length]);

  // Dynamic favicon - show club logo on club pages
  useEffect(() => {
    if (!club?.logo_url) return;

    // Store existing favicons to restore later
    const existingFavicons = Array.from(document.querySelectorAll("link[rel*='icon']"));
    
    // Remove existing favicons
    existingFavicons.forEach(favicon => favicon.remove());

    // Create new favicon links with club logo
    const faviconConfigs = [
      { rel: 'icon', type: 'image/png', sizes: '32x32' },
      { rel: 'icon', type: 'image/png', sizes: '16x16' },
      { rel: 'apple-touch-icon', sizes: '180x180' }
    ];

    faviconConfigs.forEach(({ rel, type, sizes }) => {
      const link = document.createElement('link');
      link.rel = rel;
      if (type) link.type = type;
      if (sizes) link.setAttribute('sizes', sizes);
      link.href = club.logo_url;
      document.head.appendChild(link);
    });

    // Cleanup: Restore default TAKEONE favicon when leaving page
    return () => {
      const currentFavicons = document.querySelectorAll("link[rel*='icon']");
      currentFavicons.forEach(favicon => favicon.remove());
      
      // Restore default TAKEONE favicon
      const defaultConfigs = [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon.png' }
      ];

      defaultConfigs.forEach(({ rel, type, sizes, href }) => {
        const link = document.createElement('link');
        link.rel = rel;
        if (type) link.type = type;
        if (sizes) link.setAttribute('sizes', sizes);
        link.href = href;
        document.head.appendChild(link);
      });
    };
  }, [club?.logo_url]);

  // Update page title with club name
  useEffect(() => {
    if (club?.name) {
      document.title = `${club.name} | TAKEONE`;
    }
    
    return () => {
      document.title = 'TAKEONE';
    };
  }, [club?.name]);

  const checkMembershipStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !club?.id) return;

      const { data } = await supabase
        .from('club_members')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('club_id', club.id)
        .eq('is_active', true)
        .maybeSingle();

      setIsActiveMember(!!data);
    } catch (error) {
      console.error('Error checking membership:', error);
    }
  };

  const fetchClubDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching club with params:', { clubId, countryISO, clubSlug });

      // New format only: /club/{countryISO}/{clubSlug}
      if (!countryISO || !clubSlug) {
        throw new Error('Invalid club URL - country and slug required');
      }

      console.log('Using country+slug lookup:', countryISO, clubSlug);
      const query = supabase
        .from('clubs')
        .select('*')
        .eq('country_iso', countryISO.toUpperCase())
        .eq('club_slug', clubSlug);
      
      const { data: clubData, error: clubError } = await query.maybeSingle();

      if (clubError) {
        console.error('Club fetch error:', clubError);
        throw clubError;
      }
      
      if (!clubData) {
        console.error('No club found');
        setClub(null);
        setLoading(false);
        return;
      }
      
      console.log('Club data fetched:', clubData?.name);
      setClub(clubData);
      
      // IMPORTANT: Use the actual club.id (UUID) for all subsequent queries
      const actualClubId = clubData.id;

      // Fetch club pictures for carousel
      try {
        const { data: picturesData } = await supabase
          .from('club_pictures')
          .select('image_url, description')
          .eq('club_id', actualClubId)
          .order('display_order', { ascending: true });
        setClubPictures(picturesData || []);
        console.log('Club pictures fetched:', picturesData?.length || 0);
      } catch (error) {
        console.error('Error fetching club pictures:', error);
      }

      // Fetch packages
      try {
        const { data: packagesData } = await supabase
          .from('club_packages')
          .select('*')
          .eq('club_id', actualClubId)
          .order('popularity', { ascending: false });
        setPackages(packagesData || []);
      } catch (error) {
        console.error('Error fetching packages:', error);
      }

      // Fetch instructors
      try {
        const { data: instructorsData, error: instructorError } = await supabase
          .from('club_instructors')
          .select(`
            *,
            club_members:club_members!club_instructors_member_id_fkey (
              user_id
            )
          `)
          .eq('club_id', actualClubId);
        
        if (instructorError) {
          console.error('Error fetching instructors:', instructorError);
          // Fallback to basic query
          const { data: fallbackData } = await supabase
            .from('club_instructors')
            .select('*')
            .eq('club_id', actualClubId);
          console.log(`Fetched ${fallbackData?.length || 0} instructors (fallback)`);
        } else {
          console.log(`Fetched ${instructorsData?.length || 0} instructors`);
        }
        
        // Collect unique user_ids to fetch genders
        const userIds = new Set<string>();
        instructorsData?.forEach((instr: any) => {
          const member = Array.isArray(instr.club_members) ? instr.club_members[0] : instr.club_members;
          if (member?.user_id) {
            userIds.add(member.user_id);
          }
        });
        
        // Fetch genders for all user_ids
        const genderMap = new Map<string, string>();
        if (userIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, gender')
            .in('user_id', Array.from(userIds));
          
          console.log(`Fetched ${profilesData?.length || 0} profiles for genders`);
          
          profilesData?.forEach((profile: any) => {
            genderMap.set(profile.user_id, profile.gender);
          });
        }
        
        // Map the data to include gender
        const instructorsWithGender = instructorsData?.map((instructor: any) => {
          const member = Array.isArray(instructor.club_members) ? instructor.club_members[0] : instructor.club_members;
          return {
            ...instructor,
            gender: member?.user_id ? genderMap.get(member.user_id) : undefined
          };
        }) || [];
        
        // Fetch instructor ratings
        const ratings: Record<string, number> = {};
        if (instructorsWithGender && instructorsWithGender.length > 0) {
          for (const instructor of instructorsWithGender) {
            try {
              const { data: reviewsData } = await supabase
                .from('instructor_reviews')
                .select('rating')
                .eq('instructor_id', instructor.id);
              
              if (reviewsData && reviewsData.length > 0) {
                const avgRating = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
                ratings[instructor.id] = Math.round(avgRating * 10) / 10;
              }
            } catch (error) {
              console.error(`Error fetching ratings for instructor ${instructor.id}:`, error);
            }
          }
        }
        setInstructorRatings(ratings);
        
        // Sort instructors: owner first, then by rating
        const ownerPhone = clubData?.owner_contact?.replace(/\D/g, '') || '';
        const sortedInstructors = instructorsWithGender?.sort((a, b) => {
          const aPhone = a.member_id ? '' : ownerPhone;
          const bPhone = b.member_id ? '' : ownerPhone;
          
          const aIsOwner = !a.member_id && ownerPhone && aPhone === ownerPhone;
          const bIsOwner = !b.member_id && ownerPhone && bPhone === ownerPhone;
          
          if (aIsOwner && !bIsOwner) return -1;
          if (!aIsOwner && bIsOwner) return 1;
          
          return (ratings[b.id] || 0) - (ratings[a.id] || 0);
        }) || [];
        
        setInstructors(sortedInstructors);
      } catch (error) {
        console.error('Error fetching instructors:', error);
      }

      // Fetch facilities
      const { data: facilitiesData } = await supabase
        .from('club_facilities')
        .select('*')
        .eq('club_id', actualClubId)
        .eq('is_available', true);

      // Fetch facility pictures and operating hours separately
      const facilitiesWithData: Facility[] = [];
      if (facilitiesData) {
        for (const facility of facilitiesData) {
          const { data: pictures } = await supabase
            .from('facility_pictures')
            .select('id, image_url')
            .eq('club_facility_id', facility.id);

          const { data: hours } = await supabase
            .from('facility_operating_hours')
            .select('day_of_week, start_time, end_time')
            .eq('club_facility_id', facility.id);

          facilitiesWithData.push({
            ...facility,
            pictures: pictures || [],
            operating_hours: hours || []
          });
        }
      }
      setFacilities(facilitiesWithData);

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('club_reviews')
        .select('*')
        .eq('club_id', actualClubId)
        .order('created_at', { ascending: false });
      setReviews(reviewsData || []);

      // Fetch partners
      const { data: partnersData } = await supabase
        .from('club_partners')
        .select('*')
        .eq('club_id', actualClubId)
        .order('name');
      setPartners(partnersData || []);

      // Fetch opening hours from all facilities
      if (facilitiesWithData.length > 0) {
        const { data: hoursData } = await supabase
          .from('facility_operating_hours')
          .select('day_of_week, start_time, end_time, club_facility_id')
          .in('club_facility_id', facilitiesWithData.map(f => f.id));

        // Aggregate opening hours by day
        const hoursByDay: Record<string, { earliest: string, latest: string }> = {};
        hoursData?.forEach((hour: any) => {
          const day = hour.day_of_week;
          if (!hoursByDay[day]) {
            hoursByDay[day] = { earliest: hour.start_time, latest: hour.end_time };
          } else {
            if (hour.start_time < hoursByDay[day].earliest) {
              hoursByDay[day].earliest = hour.start_time;
            }
            if (hour.end_time > hoursByDay[day].latest) {
              hoursByDay[day].latest = hour.end_time;
            }
          }
        });

        const formattedHours = Object.entries(hoursByDay).map(([day, times]) => ({
          day_of_week: day,
          earliest_open: times.earliest,
          latest_close: times.latest
        }));
        setOpeningHours(formattedHours);
      }

      // Calculate active members
      console.log('Calculating active members...');
      const { data: enrollments, error: enrollError } = await supabase
        .from('package_enrollments')
        .select('member_id, enrolled_at, is_active, package_id')
        .eq('is_active', true);

      if (enrollError) {
        console.error('Enrollment fetch error:', enrollError);
      }

      // Get package durations separately
      const packageIds = [...new Set(enrollments?.map(e => e.package_id) || [])];
      const { data: packagesForEnrollment } = await supabase
        .from('club_packages')
        .select('id, club_id, duration_months')
        .in('id', packageIds)
        .eq('club_id', actualClubId);

      const packageDurations = new Map(
        packagesForEnrollment?.map(p => [p.id, p.duration_months]) || []
      );

      const now = new Date();
      const activeMembersSet = new Set<string>();
      enrollments?.forEach((enrollment: any) => {
        const durationMonths = packageDurations.get(enrollment.package_id) || 1;
        const enrolledDate = new Date(enrollment.enrolled_at);
        const expiryDate = new Date(enrolledDate);
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
        if (expiryDate > now) activeMembersSet.add(enrollment.member_id);
      });
      setActiveMembers(activeMembersSet.size);
      console.log('Active members:', activeMembersSet.size);
      console.log('Fetch completed successfully');

      // Fetch today's scheduled activities
      try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        const { data: scheduledActivities, error: activitiesError } = await supabase
          .from('activities')
          .select(`
            id,
            title,
            description,
            picture_url,
            activity_schedules!inner(
              id,
              day_of_week,
              start_time,
              end_time
            ),
            package_activities!inner(
              package_id,
              club_packages!inner(
                id,
                name,
                club_id
              )
            )
          `)
          .eq('club_id', actualClubId)
          .eq('activity_schedules.day_of_week', today);

        if (activitiesError) throw activitiesError;

        // Process and calculate status
        const processedActivities: TodayActivity[] = (scheduledActivities || []).flatMap((activity: any) => {
          return activity.activity_schedules.map((schedule: any) => {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            
            const [startHour, startMin] = schedule.start_time.split(':').map(Number);
            const [endHour, endMin] = schedule.end_time.split(':').map(Number);
            
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            let status: 'ended' | 'running' | 'upcoming';
            let minutesUntilStart: number | undefined;
            
            if (currentTime >= endMinutes) {
              status = 'ended';
            } else if (currentTime >= startMinutes && currentTime < endMinutes) {
              status = 'running';
            } else {
              status = 'upcoming';
              minutesUntilStart = startMinutes - currentTime;
            }

            const packageData = activity.package_activities[0]?.club_packages;
            
            return {
              id: activity.id,
              activity_title: activity.title,
              activity_description: activity.description,
              activity_picture: activity.picture_url,
              schedule_id: schedule.id,
              day_of_week: schedule.day_of_week,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              package_name: packageData?.name || 'General Activity',
              status,
              minutesUntilStart
            };
          });
        });

        setTodaysActivities(processedActivities);
      } catch (error) {
        console.error("Error fetching today's activities:", error);
      }

    } catch (error) {
      console.error('Error fetching club details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerClick = (partner: Partner) => {
    setSelectedPartner(partner);
    setShowPartnerModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Club not found</h2>
          <Button onClick={() => navigate('/explore')}>
            Back to Search
          </Button>
        </div>
      </div>
    );
  }

  const categoryColors: Record<string, string> = {
    shop: "bg-blue-500",
    nutrition: "bg-green-500",
    physiotherapy: "bg-purple-500",
    supplements: "bg-orange-500",
    venues: "bg-pink-500",
    food_plans: "bg-teal-500",
  };

  const categoryIcons: Record<string, string> = {
    shop: "🏪",
    nutrition: "💪",
    physiotherapy: "🏥",
    supplements: "💊",
    venues: "🏢",
    food_plans: "🥗",
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />
      
      {/* Header Bar with Logo and Club Info + Banner */}
      <div className="container mx-auto px-4 md:px-6 pt-4">
        {/* Header Bar */}
        <div className={`bg-gradient-to-r from-black/80 to-black/70 backdrop-blur-sm text-white border-2 border-white/20 p-4 md:p-6 ${!club.image_url && clubPictures.length === 0 ? 'rounded-t-lg border-b-0' : 'rounded-t-lg border-b-0'}`}>
          <div className="flex items-start gap-4 md:gap-6">
            {/* Logo */}
            {club.logo_url && (
              <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/20 shadow-md bg-black/50 overflow-hidden">
                <img 
                  src={club.logo_url} 
                  alt={`${club.name} logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {/* Club Info */}
            <div className="flex-1 min-w-0">
              {/* Club Name */}
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold uppercase tracking-wide text-white">
                {club.name}
              </h1>
              
              {/* Separator Line */}
              <div className="h-[2px] bg-gradient-to-r from-primary via-primary/50 to-transparent my-2 md:my-3"></div>
              
              {/* Slogan */}
              {club.slogan && (
                <p className="text-sm md:text-base lg:text-lg text-white/80 font-medium">
                  {club.slogan}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Banner Carousel/Slideshow - Only show if images exist */}
        {(club.image_url || clubPictures.length > 0) && (
          <div className="relative border-2 border-t-0 border-white/20 overflow-hidden">
            <BannerCarousel 
              bannerImage={club.image_url}
              galleryImages={clubPictures}
              rating={club.rating}
            />
          </div>
        )}
      </div>

      {/* Stats Bar - No spacing from banner */}
      <div className="container mx-auto px-4 md:px-6 -mt-2">
        <div className="bg-gradient-to-r from-black/80 to-black/70 backdrop-blur-sm text-white border-2 border-white/20 rounded-b-lg">
          <div className="py-4 px-4 md:py-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{activeMembers}</p>
                  <p className="text-xs text-gray-300">Members</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Package className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{packages.length}</p>
                  <p className="text-xs text-gray-300">Packages</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Dumbbell className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{instructors.length}</p>
                  <p className="text-xs text-gray-300">Trainers</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Clock className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-bold">{club.peak_hours || 'Varies'}</p>
                  <p className="text-xs text-gray-300">Peak Hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Centered & Enhanced */}
      <div className="bg-background border-b mt-8">
        <div className="container mx-auto px-4 md:px-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-center bg-transparent border-0 h-auto p-0 flex flex-wrap">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-base font-medium">
                Overview
              </TabsTrigger>
              <TabsTrigger value="packages" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-base font-medium">
                Packages
              </TabsTrigger>
              <TabsTrigger value="today" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-base font-medium">
                Today's Schedule
              </TabsTrigger>
              <TabsTrigger value="statistics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-base font-medium">
                Statistics
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="py-8">
              <TabsContent value="overview" className="space-y-8 mt-0">
                
                {/* Club Introduction */}
                {club.slogan_explanation && (
                  <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        {club.slogan || "Our Mission"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">
                        {club.slogan_explanation}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* About Section with Combined Info */}
                <ClubAboutCard
                  description={club.description || "Discover excellence in fitness and wellness."}
                  location={club.location}
                  gpsLatitude={club.gps_latitude}
                  gpsLongitude={club.gps_longitude}
                  openingHours={openingHours}
                  linkTree={club.link_tree || []}
                  clubPhone={club.club_phone}
                  clubPhoneCode={club.club_phone_code}
                  clubEmail={club.club_email}
                />

                {/* Partners & Benefits Section */}
                {partners.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gift className="w-6 h-6 text-primary" />
                        Partner Benefits
                      </CardTitle>
                      <CardDescription>
                        Exclusive discounts and benefits for active members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {partners.map((partner) => (
                          <Card 
                            key={partner.id}
                            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
                            onClick={() => handlePartnerClick(partner)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3 mb-3">
                                {partner.logo_url && (
                                  <img 
                                    src={partner.logo_url} 
                                    alt={partner.name}
                                    className="w-16 h-16 object-contain rounded border"
                                  />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm">{partner.name}</h4>
                                  {partner.category && (
                                    <Badge className={`${categoryColors[partner.category] || 'bg-gray-500'} text-white text-xs mt-1`}>
                                      {categoryIcons[partner.category]} {partner.category.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {partner.discount_text && (
                                <div className="bg-primary/10 rounded px-3 py-2 mb-2">
                                  <p className="text-sm font-semibold text-primary">
                                    {partner.discount_text}
                                  </p>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="w-full">
                                View Details
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Two Column Layout: Trainers (1/3) & Facilities (2/3) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Trainers Section - 1/3 Width */}
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="w-6 h-6" />
                        Our Expert Trainers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {instructors.length > 0 ? (
                        <div className="space-y-4">
                          {instructors.map((instructor, index) => {
                            const realRating = instructorRatings[instructor.id];
                            const isOwner = index === 0;
                            
                            return (
                              <Card 
                                key={instructor.id} 
                                className="overflow-hidden hover:shadow-lg transition-all relative cursor-pointer"
                                onClick={() => navigate(`/trainer/${instructor.id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') navigate(`/trainer/${instructor.id}`);
                                }}
                              >
                                {isOwner && (
                                  <Badge className="absolute top-2 right-2 bg-primary z-10">
                                    Owner
                                  </Badge>
                                )}
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4 mb-3">
                                    <Avatar className={`w-16 h-16 border-2 ${getInstructorBorderColor(instructor.gender)}`}>
                                      <AvatarImage src={instructor.image_url} />
                                      <AvatarFallback className="text-lg">
                                        {instructor.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <h4 className="font-semibold">{instructor.name}</h4>
                                      <p className="text-sm text-muted-foreground">{instructor.specialty}</p>
                                      {realRating ? (
                                        <div className="flex items-center gap-1 mt-1">
                                          {[...Array(5)].map((_, i) => (
                                            <Star
                                              key={i}
                                              className={`w-3 h-3 ${
                                                i < Math.floor(realRating)
                                                  ? 'fill-yellow-400 text-yellow-400'
                                                  : 'text-gray-300'
                                              }`}
                                            />
                                          ))}
                                          <span className="text-xs font-medium ml-1">{realRating}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground mt-1">No reviews yet</p>
                                      )}
                                    </div>
                                  </div>
                                  {instructor.offers_personal_training && (
                                    <Button 
                                      size="sm" 
                                      className="w-full"
                                      variant="default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Booking logic here
                                      }}
                                    >
                                      Book
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No trainers listed</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Facilities Section - 2/3 Width */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        Our Facilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {facilities.length > 0 ? (
                        <div className="space-y-4">
                          {facilities.map((facility) => (
                            <Card key={facility.id} className="overflow-hidden hover:shadow-lg transition-all">
                              {facility.pictures.length > 0 && (
                                <div className="h-40 overflow-hidden">
                                  <img 
                                    src={facility.pictures[0].image_url} 
                                    alt={facility.name}
                                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                  />
                                </div>
                              )}
                              <CardContent className="p-4">
                                <h4 className="font-semibold mb-2">{facility.name}</h4>
                                {facility.description && (
                                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {facility.description}
                                  </p>
                                )}
                                {facility.operating_hours.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    Hours vary by day
                                  </div>
                                )}
                                <Badge variant="secondary" className="bg-green-100 text-green-700 mt-2">
                                  Available
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No facilities listed</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Member Reviews - Card Based */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="w-6 h-6" />
                        Member Reviews
                      </CardTitle>
                      <CardDescription>
                        {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                      </CardDescription>
                    </div>
                    {reviews.length > 6 && (
                      <Button 
                        variant="link" 
                        className="text-primary"
                        onClick={() => setShowReviewsModal(true)}
                      >
                        See More Reviews →
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {reviews.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reviews.slice(0, 6).map((review) => (
                          <Card key={review.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3 mb-3">
                                <Avatar className="w-10 h-10">
                                  <AvatarFallback>
                                    <User className="w-5 h-5" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm">{review.reviewer_name}</h4>
                                  <div className="flex items-center gap-1 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3 h-3 ${
                                          i < review.rating
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'fill-gray-200 text-gray-200'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {review.comment}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(review.created_at).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="packages" className="space-y-6 mt-0">
                <PackageSelector 
                  packages={packages}
                  clubId={club.id}
                  currency={club.currency || 'USD'}
                />
              </TabsContent>

              <TabsContent value="today" className="mt-0">
                {todaysActivities.length > 0 ? (
                  <div className="space-y-4">
                    {todaysActivities.map((activity) => (
                      <Card key={activity.schedule_id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Thumbnail - Left side */}
                          <div className="w-full sm:w-32 h-32 flex-shrink-0">
                            <img 
                              src={activity.activity_picture || '/placeholder.svg'} 
                              alt={activity.activity_title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* Content - Middle */}
                          <div className="flex-1 py-4 px-4 sm:px-0">
                            <h3 className="font-bold text-lg mb-1">{activity.activity_title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {activity.package_name}
                            </p>
                            {activity.activity_description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {activity.activity_description}
                              </p>
                            )}
                          </div>
                          
                          {/* Time & Status - Right side */}
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center py-4 px-4 sm:pr-4 sm:min-w-[140px] border-t sm:border-t-0 sm:border-l">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-primary">
                                {activity.start_time.substring(0, 5)}
                              </p>
                              <p className="text-xs text-muted-foreground">to</p>
                              <p className="text-2xl font-bold text-primary">
                                {activity.end_time.substring(0, 5)}
                              </p>
                            </div>
                            
                            {/* Status Badge */}
                            <div className="sm:mt-3">
                              {activity.status === 'ended' && (
                                <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                                  Ended
                                </Badge>
                              )}
                              {activity.status === 'running' && (
                                <Badge className="bg-green-500 text-white animate-pulse">
                                  Running Now
                                </Badge>
                              )}
                              {activity.status === 'upcoming' && (
                                <Badge className="bg-blue-500 text-white">
                                  {activity.minutesUntilStart && activity.minutesUntilStart < 60 
                                    ? `${activity.minutesUntilStart} min` 
                                    : `${Math.floor((activity.minutesUntilStart || 0) / 60)}h ${(activity.minutesUntilStart || 0) % 60}m`
                                  }
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CalendarDays className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">No activities scheduled for today</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Check back tomorrow or view our packages to see available activities
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="statistics" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-6 h-6" />
                      Club Statistics
                    </CardTitle>
                    <CardDescription>
                      Performance metrics and insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-6 text-center">
                          <TrendingUp className="w-12 h-12 mx-auto mb-2 text-primary" />
                          <p className="text-3xl font-bold">{activeMembers}</p>
                          <p className="text-sm text-muted-foreground">Active Members</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6 text-center">
                          <Package className="w-12 h-12 mx-auto mb-2 text-primary" />
                          <p className="text-3xl font-bold">{packages.length}</p>
                          <p className="text-sm text-muted-foreground">Total Packages</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6 text-center">
                          <Star className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
                          <p className="text-3xl font-bold">{club.rating.toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Average Rating</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <PartnerBenefitsModal
        partner={selectedPartner}
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
        isActiveMember={isActiveMember}
      />

      <ReviewsModal
        reviews={reviews}
        isOpen={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        clubName={club.name}
      />
    </div>
  );
};

export default ClubDetails;
