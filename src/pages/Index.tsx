import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Users, 
  Building2, 
  Brain, 
  Search,
  TrendingUp,
  Calendar,
  Quote,
  Shield,
  Globe,
  UserCheck
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import worldCountries from "world-countries";
import takeOneLogo from "@/assets/takeone-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    activeUsers: 0,
    clubCount: 0,
    countriesCount: 0,
    activeMembersCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  // Fetch user session and role
  useEffect(() => {
    const fetchUserAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        setUserRole(roleData?.role ?? null);
      }
    };

    fetchUserAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setUserRole(data?.role ?? null));
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch real-time statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get registered users count using public function
        const { data: usersCount } = await supabase
          .rpc('get_registered_users_count');

        // Get club count
        const { count: clubsCount } = await supabase
          .from('clubs')
          .select('*', { count: 'exact', head: true });

        // Get unique countries from multiple sources
        const [profilesData, childrenData, clubsData] = await Promise.all([
          supabase.from('profiles').select('nationality').not('nationality', 'is', null),
          supabase.from('children').select('nationality').not('nationality', 'is', null),
          supabase.from('clubs').select('country_iso').not('country_iso', 'is', null)
        ]);

        // Helper to normalize nationality to ISO code
        const normalizeToISOCode = (nationality: string | null): string | null => {
          if (!nationality || nationality === 'Unknown') return null;
          
          // If it's already a 2-character ISO code, return it
          if (nationality.length === 2) return nationality.toUpperCase();
          
          // Try to find matching country by name (case-insensitive)
          const match = worldCountries.find(
            c => c.name.common.toLowerCase() === nationality.toLowerCase() ||
                 c.name.official.toLowerCase() === nationality.toLowerCase()
          );
          
          return match ? match.cca2 : null;
        };

        const countriesSet = new Set<string>();

        // Add user nationalities (already ISO codes)
        profilesData.data?.forEach(p => {
          const iso = normalizeToISOCode(p.nationality);
          if (iso) countriesSet.add(iso);
        });

        // Add children nationalities (may be full names, need normalization)
        childrenData.data?.forEach(c => {
          const iso = normalizeToISOCode(c.nationality);
          if (iso) countriesSet.add(iso);
        });

        // Add club countries (use country_iso directly)
        clubsData.data?.forEach(club => {
          if (club.country_iso) {
            countriesSet.add(club.country_iso);
          }
        });

        // Get active members count from club_members
        const { data: membersData } = await supabase
          .from('club_members')
          .select('user_id, child_id')
          .eq('is_active', true);
        
        const activeMembersCount = membersData 
          ? new Set([
              ...membersData.map(m => m.user_id).filter(Boolean),
              ...membersData.map(m => m.child_id).filter(Boolean)
            ]).size 
          : 0;

        setStats({
          activeUsers: usersCount || 0,
          clubCount: clubsCount || 0,
          countriesCount: countriesSet.size,
          activeMembersCount
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats({ activeUsers: 0, clubCount: 0, countriesCount: 0, activeMembersCount: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleGrantSuperAdmin = async () => {
    if (!user) return;
    
    setGrantingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke('make-super-admin', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) throw error;

      toast.success("Super admin access granted!");
      setUserRole('super_admin');
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Error granting super admin:', error);
      toast.error(error.message || "Failed to grant super admin access");
    } finally {
      setGrantingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-subtle" />
        <div className="container relative px-4 py-16 md:py-24 md:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-8">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your one-stop-shop for{" "}
              <span className="text-brand-red">sports and healthcare</span>
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Find clubs, trainers, and health services with AI-powered recommendations
            </p>

            {/* Main CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg"
                onClick={() => navigate("/explore")}
                className="bg-brand-red hover:bg-brand-red-dark shadow-elegant"
              >
                <Search className="mr-2 h-5 w-5" />
                Explore Clubs & Services
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/club-owner-signup")}
              >
                <Building2 className="mr-2 h-5 w-5" />
                Register Your Business
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/admin")}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Create Events
              </Button>
            </div>

            {/* Real-time Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8">
              <Card className="p-6 border-border/50 shadow-card">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-brand-red" />
                  <span className="text-3xl font-bold text-brand-red">
                    {loading ? "..." : stats.activeUsers.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Registered Users</p>
              </Card>
              <Card className="p-6 border-border/50 shadow-card">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-brand-red" />
                  <span className="text-3xl font-bold text-brand-red">
                    {loading ? "..." : stats.clubCount}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Listed Clubs</p>
              </Card>
              <Card className="p-6 border-border/50 shadow-card">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Globe className="h-5 w-5 text-brand-red" />
                  <span className="text-3xl font-bold text-brand-red">
                    {loading ? "..." : stats.countriesCount}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Countries</p>
              </Card>
              <Card className="p-6 border-border/50 shadow-card">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <UserCheck className="h-5 w-5 text-brand-red" />
                  <span className="text-3xl font-bold text-brand-red">
                    {loading ? "..." : stats.activeMembersCount}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Active Members</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24 border-b border-border/40">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything You Need for Your Fitness Journey
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 text-center border-border/50 shadow-card hover:shadow-elegant transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-red/10 mb-4">
                <Brain className="h-6 w-6 text-brand-red" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Advisor</h3>
              <p className="text-muted-foreground">
                Get personalized recommendations powered by advanced AI technology
              </p>
            </Card>
            <Card className="p-8 text-center border-border/50 shadow-card hover:shadow-elegant transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-red/10 mb-4">
                <Search className="h-6 w-6 text-brand-red" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Club Discovery</h3>
              <p className="text-muted-foreground">
                Find the perfect clubs and trainers that match your goals and preferences
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-gradient-subtle border-b border-border/40">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Trusted by Athletes & Fitness Enthusiasts
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-6 border-border/50 shadow-card">
              <Quote className="h-8 w-8 text-brand-red/40 mb-4" />
              <p className="text-muted-foreground mb-4">
                "TAKEONE made it so easy to find the perfect gym near me. The AI recommendations were spot on!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-brand-red" />
                </div>
                <div>
                  <p className="font-semibold">Sarah M.</p>
                  <p className="text-sm text-muted-foreground">Fitness Enthusiast</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 border-border/50 shadow-card">
              <Quote className="h-8 w-8 text-brand-red/40 mb-4" />
              <p className="text-muted-foreground mb-4">
                "As a club owner, TAKEONE helped us reach more members than ever. The platform is incredibly easy to use."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-brand-red" />
                </div>
                <div>
                  <p className="font-semibold">Ahmed K.</p>
                  <p className="text-sm text-muted-foreground">Gym Owner</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-8">
            <TrendingUp className="h-12 w-12 text-brand-red mx-auto" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Transform Your Fitness Journey?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of users already achieving their fitness goals with TAKEONE
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg"
                onClick={() => navigate(user ? "/explore" : "/auth")}
                className="bg-brand-red hover:bg-brand-red-dark shadow-elegant"
              >
                Get Started Free
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/ai-advisor")}
              >
                <Brain className="mr-2 h-5 w-5" />
                Talk To AI Advisor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container px-4 py-8 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img 
                src={takeOneLogo} 
                alt="TAKEONE" 
                className="h-6 w-auto"
              />
              <span className="text-sm text-muted-foreground">
                © 2025 TAKEONE. All rights reserved.
              </span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <button className="hover:text-brand-red transition-colors">Privacy</button>
              <button className="hover:text-brand-red transition-colors">Terms</button>
              <button className="hover:text-brand-red transition-colors">Contact</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
