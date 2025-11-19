import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { 
  Search, MapPin, Star, Users, Heart, 
  Dumbbell, User, Calendar, Apple, Stethoscope, 
  Activity, ShoppingBag, Building, Utensils, Package, Loader2, Navigation, LogOut, MessageSquare, UserPlus
} from "lucide-react";
import { detectLatLngFromIP } from "@/lib/ipDetection";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { MembershipRegistrationFlow } from "./MembershipRegistrationFlow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  image_url: string;
  logo_url: string;
  rating: number;
  members_count: number;
  classes_count: number;
  trainers_count: number;
  peak_hours: string;
  gps_latitude?: number;
  gps_longitude?: number;
  driving_distance?: number | null;
  club_slug?: string | null;
  country_iso?: string | null;
}

const UserDashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRegistrationFlow, setShowRegistrationFlow] = useState(false);
  const [registrationClub, setRegistrationClub] = useState<{ 
    id: string; 
    packages: any[]; 
    hasChildren: boolean;
    userProfile?: any;
    existingChildren?: any[];
    clubData?: {
      id: string;
      name: string;
      currency: string;
      enrollment_fee: number;
      vat_percentage: number;
      vat_registration_number: string | null;
    };
  } | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      // Fetch current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      setCurrentUser(user);
      
      // Fetch user profile
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', user.id)
          .single();
        if (data?.email) {
          setUserEmail(data.email);
        }
      }
    };

    initializeUser();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchClubs();
    } else {
      // Fetch without distances if location not available
      fetchClubs();
    }
  }, [userLocation]);


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        async () => {
          console.log('Location access denied, falling back to IP-based location');
          const ipLoc = await detectLatLngFromIP();
          if (ipLoc) {
            console.log('Using IP-based location', ipLoc);
            setUserLocation(ipLoc);
          } else {
            console.warn('Could not determine location');
          }
        }
      );
    } else {
      // Geolocation not supported - fallback to IP
      (async () => {
        const ipLoc = await detectLatLngFromIP();
        if (ipLoc) setUserLocation(ipLoc);
      })();
    }
  };

  const calculateDrivingDistance = async (clubLat: number, clubLng: number): Promise<number | null> => {
    if (!userLocation) {
      console.log("No user location available for distance calculation");
      return null;
    }
    
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${clubLng},${clubLat}?overview=false`;
      console.log("Fetching driving distance:", url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("OSRM Response:", data);
      
      if (data.routes && data.routes[0]) {
        const distanceKm = data.routes[0].distance / 1000;
        console.log("Calculated distance:", distanceKm, "km");
        return distanceKm;
      }
      return null;
    } catch (error) {
      console.error("Error calculating driving distance:", error);
      return null;
    }
  };

  const fetchClubs = async () => {
    try {
      // OPTIMIZED: Fetch only necessary fields and use existing count columns
      const { data, error } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          description,
          location,
          image_url,
          logo_url,
          rating,
          members_count,
          classes_count,
          trainers_count,
          peak_hours,
          gps_latitude,
          gps_longitude,
          club_slug,
          country_iso
        `)
        .order('rating', { ascending: false });

      if (error) throw error;

      if (data) {
        // Only calculate distances if user location is available
        // Do this in batches to avoid overwhelming the API
        let clubsWithDistances: Club[];

        if (userLocation) {
          // Calculate distances for clubs with GPS coordinates
          clubsWithDistances = await Promise.all(
            data.map(async (club): Promise<Club> => {
              let drivingDistance: number | null = null;

              // Only calculate distance if club has GPS coordinates
              if (club.gps_latitude && club.gps_longitude) {
                try {
                  drivingDistance = await calculateDrivingDistance(
                    Number(club.gps_latitude),
                    Number(club.gps_longitude)
                  );
                } catch (error) {
                  console.error(`Error calculating distance for ${club.name}:`, error);
                }
              }

              return {
                ...club,
                driving_distance: drivingDistance,
              } as Club;
            })
          );
        } else {
          // Add driving_distance field even when no location
          clubsWithDistances = data.map(club => ({ ...club, driving_distance: null } as Club));
        }

        // Sort by driving distance (closest first), then by rating
        const sortedClubs = clubsWithDistances.sort((a, b) => {
          // Both have distances - sort by distance
          if (a.driving_distance !== null && b.driving_distance !== null) {
            return a.driving_distance - b.driving_distance;
          }
          // Only a has distance - prioritize it
          if (a.driving_distance !== null) return -1;
          // Only b has distance - prioritize it
          if (b.driving_distance !== null) return 1;
          // Neither has distance - sort by rating
          return (b.rating || 0) - (a.rating || 0);
        });

        console.log("Sorted clubs:", sortedClubs.map(c => ({ name: c.name, distance: c.driving_distance })));
        setClubs(sortedClubs);
      }
    } catch (error) {
      console.error('Error fetching clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'All', name: 'All', icon: Search },
    { id: 'clubs', name: 'Sports Clubs', icon: Dumbbell },
    { id: 'trainers', name: 'Personal Trainers', icon: User },
    { id: 'events', name: 'Events', icon: Calendar },
    { id: 'nutrition-centers', name: 'Nutrition Centers', icon: Apple },
    { id: 'nutrition-specialists', name: 'Nutrition Specialists', icon: Stethoscope },
    { id: 'physiotherapy-clinics', name: 'Physiotherapy Clinics', icon: Activity },
    { id: 'physiotherapy-specialists', name: 'Physiotherapy Specialists', icon: Stethoscope },
    { id: 'sports-shops', name: 'Sports Shops', icon: ShoppingBag },
    { id: 'venues', name: 'Venues for Rent', icon: Building },
    { id: 'supplements', name: 'Supplements Centers', icon: Package },
    { id: 'healthy-food', name: 'Healthy Food Plans', icon: Utensils }
  ];

  const getFilteredData = () => {
    let data: any[] = [];
    
    if (selectedCategory === 'All' || selectedCategory === 'clubs') {
      data = clubs.map(club => ({
        id: club.id,
        name: club.name,
        image: club.image_url,
        logo: club.logo_url,
        rating: club.rating,
        location: club.location,
        distance: club.driving_distance,
        category: 'Sports Club',
        members: club.members_count,
        classes: club.classes_count,
        trainers: club.trainers_count,
        type: 'club',
        club_slug: club.club_slug,
        country_iso: club.country_iso
      }));
    }
    
    return data;
  };

  const filteredData = getFilteredData().filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <FloatingBackButton fallbackRoute="/" />
      <AppHeader />

      <div className="container mx-auto px-4 py-8 md:py-12 mt-16">
        {/* Title */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-red">Find Your Perfect Fit</h1>
          <p className="text-muted-foreground text-lg">
            Discover sports clubs, trainers, nutrition centers, and more near you
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-6 shadow-elegant">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for clubs, trainers, nutrition centers..."
                  className="pl-10 h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                className="bg-brand-red hover:bg-brand-red-dark whitespace-nowrap"
                onClick={() => getUserLocation()}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Near Me
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Category Filter - Centered Grid */}
        <div className="mb-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`
                      group relative flex flex-col items-center gap-2 p-4 rounded-xl
                      border-2 transition-all duration-200
                      ${isActive 
                        ? "bg-brand-red border-brand-red text-white shadow-lg scale-105" 
                        : "bg-card border-border hover:border-brand-red hover:shadow-md hover:scale-102"
                      }
                    `}
                  >
                    <Icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      isActive ? "text-white" : "text-brand-red"
                    }`} />
                    <span className={`text-xs font-medium text-center leading-tight ${
                      isActive ? "text-white" : "text-foreground"
                    }`}>
                      {category.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {selectedCategory === 'All' ? 'Trending Near You' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {filteredData.length} results
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No results found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-elegant transition-all cursor-pointer overflow-hidden group"
                  onClick={() => {
                    if (item.type === 'club') {
                      const countryISO = item.country_iso || 'ae';
                      const slug = item.club_slug;
                      if (slug) {
                        navigate(`/club/${countryISO.toLowerCase()}/${slug}`);
                      }
                    }
                  }}
                >
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.logo && (
                      <div className="absolute bottom-3 right-3 z-10">
                        <div className="w-14 h-14 rounded-full border-2 border-white/90 shadow-lg overflow-hidden bg-white/95 backdrop-blur">
                          <img 
                            src={item.logo} 
                            alt={`${item.name} logo`}
                            className="w-full h-full object-contain rounded-full"
                          />
                        </div>
                      </div>
                    )}
                    <Badge 
                      variant="secondary" 
                      className="absolute top-4 right-4 bg-brand-red text-white hover:bg-brand-red-dark"
                    >
                      {item.category}
                    </Badge>
                    {item.rating > 0 && (
                      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md z-10">
                        <Star className="w-4 h-4 fill-brand-red text-brand-red" />
                        <span className="text-sm font-semibold">{item.rating}</span>
                      </div>
                    )}
                  </div>

                  {/* Club Name - Below Image */}
                  <div className="px-5 pt-4 pb-2">
                    <h3 className="text-2xl font-bold text-foreground leading-tight line-clamp-2">
                      {item.name.toUpperCase()}
                    </h3>
                  </div>

                  <CardContent className="px-5 pb-5 pt-2 space-y-3">
                    <div>
                      {typeof item.distance === 'number' ? (
                        <div className="flex items-center gap-1 text-sm text-brand-red mb-1">
                          <Navigation className="w-4 h-4" />
                          <span className="font-medium">{item.distance.toFixed(1)} km away</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Navigation className="w-3 h-3" />
                          <span>Enable location to see driving distance</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>{item.location}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t pt-3">
                      <div className="bg-brand-red/5 rounded-lg p-2 border border-brand-red/10 hover:border-brand-red/20 transition-colors">
                        <Users className="w-4 h-4 mx-auto mb-1 text-brand-red" />
                        <p className="text-lg font-bold text-center">{item.members}</p>
                        <p className="text-[10px] text-muted-foreground text-center font-medium">Members</p>
                      </div>
                      <div className="bg-brand-red/5 rounded-lg p-2 border border-brand-red/10 hover:border-brand-red/20 transition-colors">
                        <Package className="w-4 h-4 mx-auto mb-1 text-brand-red" />
                        <p className="text-lg font-bold text-center">{item.classes}</p>
                        <p className="text-[10px] text-muted-foreground text-center font-medium">Packages</p>
                      </div>
                      <div className="bg-brand-red/5 rounded-lg p-2 border border-brand-red/10 hover:border-brand-red/20 transition-colors">
                        <User className="w-4 h-4 mx-auto mb-1 text-brand-red" />
                        <p className="text-lg font-bold text-center">{item.trainers}</p>
                        <p className="text-[10px] text-muted-foreground text-center font-medium">Trainers</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Join Button */}
                      <Button 
                        className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white font-semibold shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          
                          // Check authentication
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            toast({
                              title: "Authentication required",
                              description: "Please sign in to join a club",
                              variant: "destructive"
                            });
                            navigate('/auth');
                            return;
                          }

                          // Fetch club packages
                          const { data: packages, error } = await supabase
                            .from('club_packages')
                            .select('*')
                            .eq('club_id', item.id);

                          if (error) {
                            toast({
                              title: "Error",
                              description: "Failed to load packages",
                              variant: "destructive"
                            });
                            return;
                          }

                          // Fetch club details with financial info
                          const { data: clubData } = await supabase
                            .from('clubs')
                            .select('id, name, currency, enrollment_fee, vat_percentage, vat_registration_number')
                            .eq('id', item.id)
                            .single();

                          // Fetch user profile
                          const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('user_id', user.id)
                            .single();

                          // Fetch user's children
                          const { data: children } = await supabase
                            .from('children')
                            .select('*')
                            .eq('parent_user_id', user.id);

                          setRegistrationClub({
                            id: item.id,
                            packages: packages || [],
                            hasChildren: (children && children.length > 0) || false,
                            userProfile: profile,
                            existingChildren: children || [],
                            clubData: clubData || undefined
                          });
                          setShowRegistrationFlow(true);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Join Club
                      </Button>
                      {/* View Details Button */}
                      <Button 
                        variant="ghost"
                        className="flex-1 text-brand-red hover:bg-brand-red/10 font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          const countryISO = item.country_iso || 'ae';
                          const slug = item.club_slug;
                          if (slug) {
                            navigate(`/club/${countryISO.toLowerCase()}/${slug}`);
                          }
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registration Flow Dialog */}
      {showRegistrationFlow && registrationClub && (
        <Dialog open={showRegistrationFlow} onOpenChange={setShowRegistrationFlow}>
          <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Join Club</DialogTitle>
              <DialogDescription>
                Complete your registration in a few steps.
              </DialogDescription>
            </DialogHeader>
            <MembershipRegistrationFlow
              clubId={registrationClub.id}
              packages={registrationClub.packages}
              clubData={registrationClub.clubData}
              hasChildren={registrationClub.hasChildren}
              existingUserMode={true}
              userProfile={registrationClub.userProfile}
              existingChildren={registrationClub.existingChildren}
              onComplete={() => {
                setShowRegistrationFlow(false);
                setRegistrationClub(null);
                fetchClubs();
                toast({
                  title: "Success!",
                  description: "Registration completed successfully"
                });
              }}
              onCancel={() => {
                setShowRegistrationFlow(false);
                setRegistrationClub(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default UserDashboard;
