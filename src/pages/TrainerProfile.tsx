import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Star, MapPin, Clock, Award, Calendar, 
  Dumbbell, Heart, Users, TrendingUp, MessageCircle,
  Phone, Mail, Instagram, Facebook, Twitter, Loader2
} from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppHeader } from "@/components/AppHeader";

const TrainerProfile: React.FC = () => {
  const navigate = useNavigate();
  const { trainerId } = useParams<{ trainerId: string }>();
  const [trainer, setTrainer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);

  const getThemeColors = (gender?: string) => {
    const isMale = gender?.toLowerCase() === 'male';
    
    return {
      avatarBorder: isMale ? 'border-blue-500/40' : 'border-primary/20',
      gradientPrimary: isMale 
        ? 'from-blue-50/50 via-blue-100/30 to-blue-50/20 dark:from-blue-950/30 dark:via-blue-900/20 dark:to-blue-950/10'
        : 'from-primary/5 via-wellness/5 to-energy/5',
      gradientSecondary: isMale
        ? 'from-blue-100/50 to-blue-50/30 dark:from-blue-900/30 dark:to-blue-950/20'
        : 'from-primary/5 to-primary/10',
      gradientWellness: isMale
        ? 'from-sky-50/50 to-sky-100/30 dark:from-sky-950/30 dark:to-sky-900/20'
        : 'from-wellness/5 to-wellness/10',
      iconBgPrimary: isMale ? 'bg-blue-100/50 dark:bg-blue-900/30' : 'bg-primary/10',
      iconBgSecondary: isMale ? 'bg-sky-100/50 dark:bg-sky-900/30' : 'bg-wellness/10',
      textPrimary: isMale ? 'text-blue-600 dark:text-blue-400' : 'text-primary',
      textSecondary: isMale ? 'text-sky-600 dark:text-sky-400' : 'text-wellness',
      decorativeCircle: isMale ? 'bg-blue-500/10' : 'bg-primary/10',
      accentLine: isMale ? 'from-blue-500 to-sky-500' : 'from-primary to-wellness',
    };
  };

  useEffect(() => {
    if (trainerId) {
      fetchTrainerData();
    }
  }, [trainerId]);

  const fetchTrainerData = async () => {
    if (!trainerId) return;
    
    setLoading(true);
    try {
      const { data: instructorData } = await supabase
        .from('club_instructors')
        .select(`
          *, 
          club:clubs(name),
          club_members:club_members!club_instructors_member_id_fkey (
            user_id
          )
        `)
        .eq('id', trainerId)
        .single();

      // Fetch gender from profiles table using user_id from club_members
      let gender = null;
      if (instructorData) {
        const member = Array.isArray(instructorData.club_members) 
          ? instructorData.club_members[0] 
          : instructorData.club_members;
        
        if (member?.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('gender')
            .eq('user_id', member.user_id)
            .single();
          
          gender = profileData?.gender;
        }
      }

      if (instructorData) {
        const { data: classData } = await supabase
          .from('club_classes')
          .select('*')
          .eq('instructor_id', trainerId);

        // Fetch certifications from the new table
        const { data: certificationsData } = await supabase
          .from('instructor_certifications')
          .select('*')
          .eq('instructor_id', trainerId)
          .order('awarded_date', { ascending: false });

        setCertifications(certificationsData || []);

        // Get schedule for classes
        const scheduleByDay: Record<string, string[]> = {};
        if (classData) {
          for (const cls of classData) {
            const { data: activities } = await supabase
              .from('activities')
              .select('id')
              .eq('title', cls.name)
              .eq('club_id', instructorData.club_id);

            if (activities && activities.length > 0) {
              const { data: schedules } = await supabase
                .from('activity_schedules')
                .select('*')
                .eq('activity_id', activities[0].id);

              if (schedules) {
                schedules.forEach(s => {
                  if (!scheduleByDay[s.day_of_week]) scheduleByDay[s.day_of_week] = [];
                  scheduleByDay[s.day_of_week].push(`${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}`);
                });
              }
            }
          }
        }

        const weekSchedule = Object.entries(scheduleByDay).map(([day, times]) => ({
          day,
          times
        }));

        // Calculate total lifetime clients for this instructor
        // Get all packages that this instructor teaches
        const { data: instructorPackages } = await supabase
          .from('package_activities')
          .select('package_id, activity_id')
          .eq('instructor_id', trainerId);

        const packageIds = instructorPackages?.map(p => p.package_id) || [];
        
        // Count distinct members who have ever enrolled in these packages (active or inactive)
        let totalClients = 0;
        if (packageIds.length > 0) {
          const { data: enrollments } = await supabase
            .from('package_enrollments')
            .select('member_id')
            .in('package_id', packageIds);

          // Count unique members
          const uniqueMembers = new Set(enrollments?.map(e => e.member_id) || []);
          totalClients = uniqueMembers.size;
        }

        // Count unique activities/classes taught by this instructor
        const uniqueActivities = new Set(instructorPackages?.map(p => p.activity_id) || []);
        const totalSessions = uniqueActivities.size;

        // Get instructor reviews and calculate average rating
        const { data: reviews } = await supabase
          .from('instructor_reviews')
          .select('rating')
          .eq('instructor_id', trainerId);

        let calculatedRating = 0;
        const reviewCount = reviews?.length || 0;
        
        if (reviews && reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          calculatedRating = Number((totalRating / reviews.length).toFixed(1));
        }

        setTrainer({
          ...instructorData,
          gender,
          schedule: weekSchedule,
          stats: {
            clients: totalClients,
            sessions: totalSessions,
            rating: calculatedRating,
            certifications: certificationsData?.length || 0
          },
          specialties: [instructorData.specialty],
          achievements: [
            { title: "Top Rated Trainer", icon: Award },
            { title: "Sessions Completed", icon: Dumbbell },
            { title: "Client Favorite", icon: Heart }
          ],
          reviews: [
            { name: "Client", rating: 5, date: "1 week ago", comment: `${instructorData.name} is an excellent trainer with great expertise!` }
          ]
        });
        setClasses(classData || []);
      }
    } catch (error) {
      console.error('Error fetching trainer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <FloatingBackButton fallbackRoute="/explore" />
        <div className="max-w-6xl mx-auto p-4 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <FloatingBackButton fallbackRoute="/explore" />
        <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Trainer Not Found</h2>
            <p className="text-muted-foreground">The trainer you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />
      <div className="max-w-6xl mx-auto p-4 space-y-6">

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="relative">
              <img 
                src={trainer.image_url || "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop"} 
                alt={trainer.name}
                className={`w-32 h-32 md:w-48 md:h-48 rounded-full object-cover border-4 ${getThemeColors(trainer.gender).avatarBorder}`}
              />
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{trainer.name}</h1>
                  <div className="flex items-center gap-4 mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-400 fill-current" />
                      <span className="font-semibold">{trainer.stats.rating > 0 ? trainer.stats.rating : 'N/A'}</span>
                      <span className="text-muted-foreground">({trainer.stats.certifications} certifications)</span>
                    </div>
                    <Badge className="bg-primary text-primary-foreground">{trainer.specialty}</Badge>
                    <Badge variant="secondary">{trainer.experience} experience</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">{trainer.bio}</p>
                  {trainer.club && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{trainer.club.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button className="w-full md:w-auto">
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Session
                  </Button>
                  <Button variant="outline" className="w-full md:w-auto">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`text-center p-3 border rounded-lg ${trainer.gender?.toLowerCase() === 'male' ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                  <p className={`text-2xl font-bold ${getThemeColors(trainer.gender).textPrimary}`}>{trainer.stats.clients}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </div>
                <div className={`text-center p-3 border rounded-lg ${trainer.gender?.toLowerCase() === 'male' ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                  <p className={`text-2xl font-bold ${trainer.gender?.toLowerCase() === 'male' ? 'text-sky-600 dark:text-sky-400' : 'text-wellness'}`}>{trainer.stats.sessions}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
                <div className={`text-center p-3 border rounded-lg ${trainer.gender?.toLowerCase() === 'male' ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                  <p className={`text-2xl font-bold ${trainer.gender?.toLowerCase() === 'male' ? 'text-indigo-600 dark:text-indigo-400' : 'text-energy'}`}>{trainer.stats.rating}</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
                <div className={`text-center p-3 border rounded-lg ${trainer.gender?.toLowerCase() === 'male' ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                  <p className={`text-2xl font-bold ${getThemeColors(trainer.gender).textPrimary}`}>{trainer.stats.certifications}</p>
                  <p className="text-xs text-muted-foreground">Certifications</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="about" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="space-y-6">
          {/* Bio */}
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">About {trainer.name}</h3>
                  <p className="text-sm text-muted-foreground">Professional trainer dedicated to your fitness journey</p>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6 space-y-6">
              {/* Bio Text */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-1 w-8 bg-gradient-to-r ${getThemeColors(trainer.gender).accentLine} rounded-full`}></div>
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Biography</span>
                </div>
                <p className="text-foreground leading-relaxed text-base pl-10">
                  {trainer.bio}
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {/* Specialty Card */}
                <div className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${getThemeColors(trainer.gender).gradientSecondary} p-5 hover:shadow-md transition-all duration-300`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 ${getThemeColors(trainer.gender).decorativeCircle} rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110`}></div>
                  <div className="relative flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${getThemeColors(trainer.gender).iconBgPrimary} group-hover:bg-opacity-80 transition-colors`}>
                      <Award className={`w-5 h-5 ${getThemeColors(trainer.gender).textPrimary}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Specialty</p>
                      <p className="text-lg font-bold text-foreground">{trainer.specialty}</p>
                    </div>
                  </div>
                </div>

                {/* Experience Card */}
                <div className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${getThemeColors(trainer.gender).gradientWellness} p-5 hover:shadow-md transition-all duration-300`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 ${getThemeColors(trainer.gender).decorativeCircle} rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110`}></div>
                  <div className="relative flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${getThemeColors(trainer.gender).iconBgSecondary} group-hover:bg-opacity-80 transition-colors`}>
                      <TrendingUp className={`w-5 h-5 ${getThemeColors(trainer.gender).textSecondary}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Experience</p>
                      <p className="text-lg font-bold text-foreground">{trainer.experience}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Classes Section */}
              {classes.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-8 bg-gradient-to-r from-energy to-primary rounded-full"></div>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classes Taught</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 pl-10">
                    {classes.map((cls: any) => (
                      <Badge 
                        key={cls.id} 
                        variant="outline" 
                        className="px-4 py-1.5 text-sm font-medium border-2 hover:bg-primary/5 hover:border-primary transition-all cursor-default"
                      >
                        <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                        {cls.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <Award className="w-6 h-6 text-energy" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Achievements & Milestones</h3>
                  <p className="text-sm text-muted-foreground">Recognition for excellence and dedication</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {trainer.achievements.map((achievement: any, index: number) => {
                  const Icon = achievement.icon;
                  const isMale = trainer.gender?.toLowerCase() === 'male';
                  const gradients = isMale 
                    ? ['from-blue-100/40 to-blue-50/20 dark:from-blue-900/30 dark:to-blue-950/20', 
                       'from-sky-100/40 to-sky-50/20 dark:from-sky-900/30 dark:to-sky-950/20', 
                       'from-indigo-100/40 to-indigo-50/20 dark:from-indigo-900/30 dark:to-indigo-950/20']
                    : ['from-primary/10 to-primary/5', 'from-wellness/10 to-wellness/5', 'from-energy/10 to-energy/5'];
                  const iconColors = isMale
                    ? ['text-blue-600 dark:text-blue-400', 'text-sky-600 dark:text-sky-400', 'text-indigo-600 dark:text-indigo-400']
                    : ['text-primary', 'text-wellness', 'text-energy'];
                  return (
                    <div 
                      key={index} 
                      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradients[index % 3]} p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-background/50 to-transparent rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="relative flex flex-col items-center text-center gap-3">
                        <div className={`w-14 h-14 rounded-full bg-background shadow-md flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-7 h-7 ${iconColors[index % 3]}`} />
                        </div>
                        <p className="font-bold text-sm">{achievement.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <Award className="w-6 h-6 text-wellness" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Certifications & Credentials</h3>
                  <p className="text-sm text-muted-foreground">Professional qualifications verified for authenticity</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {certifications.length > 0 ? (
                <div className="space-y-6">
                  {certifications.map((cert: any) => (
                    <div 
                      key={cert.id} 
                      className={`group border rounded-xl overflow-hidden bg-gradient-to-br from-background ${trainer.gender?.toLowerCase() === 'male' ? 'to-blue-50/30 dark:to-blue-950/20' : 'to-wellness/5'} hover:shadow-lg transition-all`}
                    >
                      {/* Certificate Image */}
                      {cert.certificate_image_url && (
                        <div className="relative h-64 bg-muted overflow-hidden">
                          <img 
                            src={cert.certificate_image_url}
                            alt={cert.certificate_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          <div className="absolute bottom-4 left-4 right-4">
                            <h4 className="font-bold text-xl text-white mb-1">{cert.certificate_name}</h4>
                            <p className="text-white/90 text-sm">{cert.issuing_organization}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Certificate Details */}
                      <div className="p-5 space-y-4">
                        {!cert.certificate_image_url && (
                          <div className="mb-3">
                            <h4 className="font-bold text-xl mb-1">{cert.certificate_name}</h4>
                            <p className="text-muted-foreground">{cert.issuing_organization}</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Awarded Date */}
                          <div className="flex items-center gap-3 p-3 bg-background border rounded-lg">
                            <div className="p-2 rounded-lg bg-wellness/10">
                              <Calendar className="w-4 h-4 text-wellness" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Awarded</p>
                              <p className="font-semibold">{new Date(cert.awarded_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                            </div>
                          </div>
                          
                          {/* Expiry Date */}
                          {cert.expiry_date && (
                            <div className="flex items-center gap-3 p-3 bg-background border rounded-lg">
                              <div className="p-2 rounded-lg bg-info/10">
                                <Clock className="w-4 h-4 text-info" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valid Until</p>
                                <p className="font-semibold">{new Date(cert.expiry_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Certificate Number */}
                          {cert.certificate_number && (
                            <div className="flex items-center gap-3 p-3 bg-background border rounded-lg md:col-span-2">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Award className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Certificate ID</p>
                                <p className="font-mono font-semibold text-sm">{cert.certificate_number}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                Verifiable
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        {/* Description */}
                        {cert.description && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground leading-relaxed">{cert.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Award className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No certifications added yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <Clock className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Weekly Schedule</h3>
                  <p className="text-sm text-muted-foreground">Available training sessions throughout the week</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {trainer.schedule && trainer.schedule.length > 0 ? (
                <div className="space-y-3">
                  {trainer.schedule.map((day: any, index: number) => (
                    <div 
                      key={index} 
                      className={`group rounded-xl border bg-gradient-to-r from-background ${trainer.gender?.toLowerCase() === 'male' ? 'to-blue-50/30 dark:to-blue-950/20' : 'to-primary/5'} p-5 hover:shadow-md transition-all`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="min-w-[120px]">
                          <div className={`inline-flex items-center gap-2 px-4 py-2 ${getThemeColors(trainer.gender).iconBgPrimary} rounded-lg`}>
                            <Calendar className={`w-4 h-4 ${getThemeColors(trainer.gender).textPrimary}`} />
                            <p className={`font-bold ${getThemeColors(trainer.gender).textPrimary}`}>{day.day}</p>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="space-y-2">
                            {day.times.map((time: string, timeIndex: number) => (
                              <div 
                                key={timeIndex} 
                                className="flex items-center justify-between p-3 bg-background border rounded-lg hover:border-primary transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{time}</span>
                                </div>
                                <Button size="sm" className="shadow-sm">
                                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                  Book
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Schedule information coming soon</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <MessageCircle className="w-6 h-6 text-wellness" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Client Reviews</h3>
                  <p className="text-sm text-muted-foreground">What our clients say about their experience</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              {trainer.reviews.map((review: any, index: number) => (
                <div 
                  key={index} 
                  className={`group p-5 border rounded-xl bg-gradient-to-br from-background ${trainer.gender?.toLowerCase() === 'male' ? 'to-blue-50/30 dark:to-blue-950/20' : 'to-primary/5'} hover:shadow-md transition-all last:border-b-0`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${trainer.gender?.toLowerCase() === 'male' ? 'from-blue-500 to-sky-500' : 'from-primary to-wellness'} flex items-center justify-center shadow-sm`}>
                        <span className="text-lg font-bold text-white">{review.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-bold text-base">{review.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {review.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg border border-yellow-200 dark:border-yellow-500/20">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed pl-15">{review.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card className="overflow-hidden">
            <div className={`bg-gradient-to-br ${getThemeColors(trainer.gender).gradientPrimary} p-6 border-b`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm border">
                  <Phone className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Contact Information</h3>
                  <p className="text-sm text-muted-foreground">Get in touch to start your training journey</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              {/* Phone */}
              <div className={`group flex items-center gap-4 p-5 border rounded-xl bg-gradient-to-r from-background ${trainer.gender?.toLowerCase() === 'male' ? 'to-blue-50/30 dark:to-blue-950/20 hover:border-blue-500' : 'to-info/5 hover:border-info'} hover:shadow-md transition-all`}>
                <div className="p-3 rounded-xl bg-info/10 group-hover:bg-info/20 transition-colors">
                  <Phone className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                  <p className="font-bold text-base">Contact through club</p>
                </div>
              </div>
              
              {/* Email */}
              <div className={`group flex items-center gap-4 p-5 border rounded-xl bg-gradient-to-r from-background ${trainer.gender?.toLowerCase() === 'male' ? 'to-sky-50/30 dark:to-sky-950/20 hover:border-sky-500' : 'to-primary/5 hover:border-primary'} hover:shadow-md transition-all`}>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                  <p className="font-bold text-base">Available upon request</p>
                </div>
              </div>

              {/* Social Media */}
              <div className="pt-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Connect on Social Media</p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="flex-1 hover:bg-gradient-to-r hover:from-pink-500 hover:to-orange-500 hover:text-white hover:border-transparent transition-all"
                  >
                    <Instagram className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="flex-1 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-500 hover:text-white hover:border-transparent transition-all"
                  >
                    <Facebook className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="flex-1 hover:bg-gradient-to-r hover:from-sky-500 hover:to-blue-400 hover:text-white hover:border-transparent transition-all"
                  >
                    <Twitter className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default TrainerProfile;
