import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminClubs } from "@/components/admin/AdminClubs";
import { AdminClubDetails } from "@/components/admin/AdminClubDetails";
import { AdminFacilities } from "@/components/admin/AdminFacilities";
import { AdminInstructors } from "@/components/admin/AdminInstructors";
import { AdminActivities } from "@/components/admin/AdminActivities";
import { AdminPackages } from "@/components/admin/AdminPackages";
import { AdminGallery } from "@/components/admin/AdminGallery";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMembers } from "@/components/admin/AdminMembers";
import { AdminAllMembers } from "@/components/admin/AdminAllMembers";
import { FloatingChatBubble } from "@/components/admin/FloatingChatBubble";
import { CleanupDuplicateInstructor } from "@/components/admin/CleanupDuplicateInstructor";
import { AdminBackupRestore } from "@/components/admin/AdminBackupRestore";
import { AdminFinancials } from "@/components/admin/AdminFinancials";
import { ExpiringSubscriptionsPanel } from "@/components/admin/ExpiringSubscriptionsPanel";
import { MessagingPanel } from "@/components/MessagingPanel";
import { AppHeader } from "@/components/AppHeader";
import { TransactionsByMonthDialog } from "@/components/admin/TransactionsByMonthDialog";
import { Search, ArrowLeft, MapPin, Users, Dumbbell, Star, Eye, Building2, TrendingUp, Bell, LifeBuoy, BookOpen, MessageCircle, ExternalLink, MessageSquare, DoorOpen, Database, Copy, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currencyUtils";

const Admin: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'super_admin' | 'business_owner' | 'admin' | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("details");
  const [mainView, setMainView] = useState<"clubs" | "members" | "backup">("clubs");
  const [activeMembersCount, setActiveMembersCount] = useState<number>(0);
  const [activitiesCount, setActivitiesCount] = useState<number>(0);
  const [trainersCount, setTrainersCount] = useState<number>(0);
  const [memberRating, setMemberRating] = useState<number>(0);
  const [packagesCount, setPackagesCount] = useState<number>(0);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showMonthTransactions, setShowMonthTransactions] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ month: string; year: number } | null>(null);

  // Fetch transaction data for financial overview
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["transactions", selectedClubId],
    queryFn: async () => {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data, error } = await supabase
        .from("transaction_ledger")
        .select("*")
        .eq("club_id", selectedClubId)
        .gte("transaction_date", twelveMonthsAgo.toISOString())
        .order("transaction_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClubId && activeSection === "dashboard",
  });

  // Process transactions into monthly data - matches AdminFinancials logic
  const monthlyData = React.useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    // Initialize last 12 months with zero values
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyTotals[key] = { income: 0, expenses: 0 };
    }

    // Aggregate transaction data by month
    transactions.forEach((entry: any) => {
      const date = new Date(entry.transaction_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (monthlyTotals[key]) {
        const amount = parseFloat(String(entry.total_amount || 0));
        if (['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental', 'manual_income'].includes(entry.transaction_type)) {
          monthlyTotals[key].income += amount;
        } else if (entry.transaction_type === 'expense') {
          monthlyTotals[key].expenses += amount;
        } else if (entry.transaction_type === 'refund') {
          monthlyTotals[key].expenses += amount; // Treat refunds as expenses
        }
      }
    });

    // Convert to chart format
    return Object.keys(monthlyTotals)
      .sort()
      .map(key => {
        const [year, monthIndex] = key.split('-').map(Number);
        return {
          month: monthNames[monthIndex],
          income: monthlyTotals[key].income,
          expense: monthlyTotals[key].expenses,
          profit: monthlyTotals[key].income - monthlyTotals[key].expenses
        };
      });
  }, [transactions]);

  // Mock chat data - replace with real data from your backend
  const unreadChats = [
    {
      id: '1',
      userName: 'Sarah Johnson',
      userAvatar: '',
      lastMessage: 'Hi, I have a question about my membership package',
      unreadCount: 2,
      timestamp: '5 min ago'
    },
    {
      id: '2',
      userName: 'Mike Chen',
      userAvatar: '',
      lastMessage: 'When does the new yoga class start?',
      unreadCount: 1,
      timestamp: '1 hour ago'
    },
    {
      id: '3',
      userName: 'Emma Wilson',
      userAvatar: '',
      lastMessage: 'Thanks for your help!',
      unreadCount: 1,
      timestamp: '3 hours ago'
    }
  ];

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id ?? null;
      setSessionUserId(uid);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (!sessionUserId) { setLoading(false); return; }

        // Fetch user role
        const { data: roles, error: rolesErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", sessionUserId);
        if (rolesErr) throw rolesErr;

        // Determine specific role (prioritize super_admin > business_owner > admin)
        if (roles?.some(r => r.role === "super_admin")) {
          setUserRole('super_admin');
          setIsAdmin(true);
        } else if (roles?.some(r => r.role === "business_owner")) {
          setUserRole('business_owner');
          setIsAdmin(true);
        } else if (roles?.some(r => r.role === "admin")) {
          // Legacy admin - treat as business_owner
          setUserRole('admin');
          setIsAdmin(true);
        } else {
          // Try first-admin bootstrap
          const { data: result } = await supabase.functions.invoke("grant-admin-first", { body: { user_id: sessionUserId } });
          
          if (result?.granted) {
            setUserRole('super_admin');
            setIsAdmin(true);
            toast({ title: "Admin granted", description: "Your account is now admin (first-run)." });
          } else {
            setIsAdmin(false);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [sessionUserId, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchClubs();
    }
  }, [isAdmin]);

  // Refresh dashboard data when returning to dashboard section
  useEffect(() => {
    if (activeSection === "dashboard" && selectedClubId) {
      refreshDashboardData();
      // Force refresh transactions query
      queryClient.invalidateQueries({ queryKey: ["transactions", selectedClubId] });
    }
  }, [activeSection, selectedClubId]);

  const fetchClubs = async () => {
    console.log("Fetching clubs for role:", userRole);
    
    let query = supabase.from("clubs").select("*");
    
    // Apply role-based filtering
    if (userRole === 'business_owner' || userRole === 'admin') {
      // Business owners/admins only see their clubs
      query = query.eq('business_owner_id', sessionUserId);
    }
    // super_admin sees all clubs (no filter)
    
    let { data, error } = await query.order("name");
    
    console.log("Clubs fetch result:", { data, error, userRole });
    
    // Fallback: If no clubs found for business_owner/admin, check club_members for Owner rank
    if (!error && (!data || data.length === 0) && (userRole === 'business_owner' || userRole === 'admin')) {
      console.log("No clubs found via business_owner_id, checking club_members...");
      
      const { data: memberClubs, error: memberError } = await supabase
        .from("club_members")
        .select("club_id, clubs!inner(*)")
        .eq("user_id", sessionUserId)
        .ilike("rank", "owner")
        .eq("is_active", true);
      
      if (!memberError && memberClubs && memberClubs.length > 0) {
        data = memberClubs.map((mc: any) => mc.clubs);
        console.log("Found clubs via club_members fallback:", data);
        
        // Auto-repair: Call reconcile function to fix the data
        try {
          const { data: repairResult, error: repairError } = await supabase.functions.invoke(
            "reconcile-club-owners",
            { body: { scoped: true } }
          );
          
          if (!repairError && repairResult?.results?.length > 0) {
            toast({
              title: "Club ownership fixed",
              description: `Linked ${repairResult.results.length} club(s) to your account`,
            });
            // Refetch with corrected data
            const { data: refreshedData } = await supabase
              .from("clubs")
              .select("*")
              .eq('business_owner_id', sessionUserId)
              .order("name");
            if (refreshedData) data = refreshedData;
          }
        } catch (repairErr) {
          console.error("Auto-repair failed:", repairErr);
        }
      }
    }
    
    if (!error && data) {
      // Calculate real-time statistics for each club
      const clubsWithStats = await Promise.all(
        data.map(async (club) => {
          // Get active members count with non-expired package enrollments
          const { data: enrollments } = await supabase
            .from("package_enrollments")
            .select(`
              member_id,
              enrolled_at,
              is_active,
              club_packages!inner(
                club_id,
                duration_months
              )
            `)
            .eq("club_packages.club_id", club.id)
            .eq("is_active", true);

          const now = new Date();
          const activeMembers = new Set();
          
          enrollments?.forEach((enrollment: any) => {
            const enrolledDate = new Date(enrollment.enrolled_at);
            const durationMonths = enrollment.club_packages.duration_months || 1;
            const expiryDate = new Date(enrolledDate);
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            
            if (expiryDate > now) {
              activeMembers.add(enrollment.member_id);
            }
          });

          // Get packages count
          const { count: packagesCount } = await supabase
            .from("club_packages")
            .select("*", { count: "exact", head: true })
            .eq("club_id", club.id);

          // Get trainers count
          const { count: trainersCount } = await supabase
            .from("club_instructors")
            .select("*", { count: "exact", head: true })
            .eq("club_id", club.id);

          return {
            ...club,
            members_count: activeMembers.size,
            classes_count: packagesCount || 0,
            trainers_count: trainersCount || 0
          };
        })
      );

      setClubs(clubsWithStats);
      
      // Auto-select if business owner has only one club
      if ((userRole === 'business_owner' || userRole === 'admin') && clubsWithStats.length === 1) {
        handleSelectClub(clubsWithStats[0]);
      }
    }
  };

  const handleSelectClub = (club: any) => {
    setSelectedClub(club);
    setSelectedClubId(club.id);
    setActiveSection("dashboard");
    fetchDashboardData(club.id);
  };

  const refreshDashboardData = () => {
    if (selectedClubId) {
      fetchDashboardData(selectedClubId);
    }
  };

  const fetchDashboardData = async (clubId: string) => {
    await Promise.all([
      fetchActiveMembersCount(clubId),
      fetchActivitiesCount(clubId),
      fetchTrainersCount(clubId),
      fetchMemberRating(clubId),
      fetchPackagesCount(clubId)
    ]);
  };

  const fetchActivitiesCount = async (clubId: string) => {
    try {
      const { count, error } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId);

      if (error) throw error;
      setActivitiesCount(count || 0);
    } catch (error) {
      console.error("Error fetching activities count:", error);
      setActivitiesCount(0);
    }
  };

  const fetchTrainersCount = async (clubId: string) => {
    try {
      const { count, error } = await supabase
        .from("club_instructors")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId);

      if (error) throw error;
      setTrainersCount(count || 0);
    } catch (error) {
      console.error("Error fetching trainers count:", error);
      setTrainersCount(0);
    }
  };

  const fetchMemberRating = async (clubId: string) => {
    try {
      const { data, error } = await supabase
        .from("club_reviews")
        .select("rating")
        .eq("club_id", clubId);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const avgRating = data.reduce((sum, review) => sum + review.rating, 0) / data.length;
        setMemberRating(Math.round(avgRating * 10) / 10); // Round to 1 decimal
      } else {
        setMemberRating(0);
      }
    } catch (error) {
      console.error("Error fetching member rating:", error);
      setMemberRating(0);
    }
  };

  const fetchPackagesCount = async (clubId: string) => {
    try {
      const { count, error } = await supabase
        .from("club_packages")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId);

      if (error) throw error;
      setPackagesCount(count || 0);
    } catch (error) {
      console.error("Error fetching packages count:", error);
      setPackagesCount(0);
    }
  };

  const fetchActiveMembersCount = async (clubId: string) => {
    try {
      // Get all active package enrollments for this club
      const { data: enrollments, error } = await supabase
        .from("package_enrollments")
        .select(`
          member_id,
          enrolled_at,
          is_active,
          package_id,
          club_packages!inner(
            club_id,
            duration_months
          )
        `)
        .eq("club_packages.club_id", clubId)
        .eq("is_active", true);

      if (error) throw error;

      // Filter enrollments that are still within their valid period
      const now = new Date();
      const activeMembers = new Set();
      
      enrollments?.forEach((enrollment: any) => {
        const enrolledDate = new Date(enrollment.enrolled_at);
        const durationMonths = enrollment.club_packages.duration_months || 1;
        const expiryDate = new Date(enrolledDate);
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
        
        // If enrollment hasn't expired, count this member
        if (expiryDate > now) {
          activeMembers.add(enrollment.member_id);
        }
      });

      setActiveMembersCount(activeMembers.size);
    } catch (error) {
      console.error("Error fetching active members:", error);
      setActiveMembersCount(0);
    }
  };

  const handleBackToClubs = () => {
    setSelectedClub(null);
    setSelectedClubId(null);
    setActiveSection("details");
    setMainView("clubs");
    fetchClubs();
  };

  const filteredClubs = clubs.filter(club =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({ title: "URL Copied!", description: "Club URL copied to clipboard" });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast({ title: "Copy Failed", description: "Could not copy URL", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  if (!sessionUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Admin</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4">You must sign in to access the admin dashboard.</p>
            <Button onClick={() => navigate("/auth")}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin || !sessionUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardHeader><CardTitle>Admin Access Required</CardTitle></CardHeader>
          <CardContent>
            <p>If this is the first run, click Refresh after signing in — your account may be granted admin automatically.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => window.location.reload()}>Refresh</Button>
              <Button variant="secondary" onClick={() => navigate("/")}>Back Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <CleanupDuplicateInstructor />
      
      {!selectedClub ? (
        <div className="container px-4 md:px-6">
          <div className="flex min-h-[calc(100vh-4rem)] w-full">
          {/* Admin Navigation Sidebar - Desktop */}
          <aside className="w-64 border-r border-border bg-muted/30 p-6 sticky top-16 h-[calc(100vh-4rem)] hidden lg:block">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Admin Panel</h2>
            
            <nav className="space-y-2">
              {/* All Clubs */}
              <button
                onClick={() => setMainView("clubs")}
                className={`w-full flex items-start gap-3 p-4 rounded-lg transition-all ${
                  mainView === "clubs" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "bg-card hover:bg-muted hover:shadow-md"
                }`}
              >
                <Building2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm">{userRole === 'super_admin' ? 'All Clubs' : 'My Clubs'}</p>
                  <p className={`text-xs mt-0.5 ${mainView === "clubs" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Manage {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}
                  </p>
                </div>
              </button>

              {/* All Members (super_admin only) */}
              {userRole === 'super_admin' && (
                <button
                  onClick={() => setMainView("members")}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg transition-all ${
                    mainView === "members" 
                      ? "bg-primary text-primary-foreground shadow-lg" 
                      : "bg-card hover:bg-muted hover:shadow-md"
                  }`}
                >
                  <Users className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm">All Members</p>
                    <p className={`text-xs mt-0.5 ${mainView === "members" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      View all platform members
                    </p>
                  </div>
                </button>
              )}

              {/* Backup & Restore (super_admin only) */}
              {userRole === 'super_admin' && (
                <button
                  onClick={() => setMainView("backup")}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg transition-all ${
                    mainView === "backup" 
                      ? "bg-primary text-primary-foreground shadow-lg" 
                      : "bg-card hover:bg-muted hover:shadow-md"
                  }`}
                >
                  <Database className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm">Backup & Restore</p>
                    <p className={`text-xs mt-0.5 ${
                      mainView === "backup" ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      Database management
                    </p>
                  </div>
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-border my-4"></div>

              {/* Back to Explore */}
              <button
                onClick={() => navigate("/explore")}
                className="w-full flex items-start gap-3 p-4 rounded-lg transition-all bg-card hover:bg-accent hover:shadow-md border border-border"
              >
                <Eye className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm">Back to Explore</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    View as user
                  </p>
                </div>
              </button>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-6">
            {/* Mobile Navigation Dropdown */}
            <div className="lg:hidden mb-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      {mainView === "clubs" ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      {mainView === "clubs" ? (userRole === 'super_admin' ? 'All Clubs' : 'My Clubs') : 'All Members'}
                    </span>
                    <Search className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem onClick={() => setMainView("clubs")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    {userRole === 'super_admin' ? 'All Clubs' : 'My Clubs'}
                  </DropdownMenuItem>
                  {userRole === 'super_admin' && (
                    <>
                    <DropdownMenuItem onClick={() => setMainView("members")}>
                      <Users className="h-4 w-4 mr-2" />
                      All Members
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMainView("backup")}>
                      <Database className="h-4 w-4 mr-2" />
                      Backup & Restore
                    </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/explore")}>
                    <Eye className="h-4 w-4 mr-2" />
                    Back to Explore
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          {/* Content based on mainView */}
          {mainView === "backup" && userRole === 'super_admin' ? (
            <AdminBackupRestore />
          ) : mainView === "clubs" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold">
                      {userRole === 'super_admin' ? 'All Clubs' : 'My Clubs'}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {userRole === 'super_admin' 
                        ? 'Manage all clubs on the platform' 
                        : 'Select a club to manage its content'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Only super_admin sees create club button here */}
                    {userRole === 'super_admin' && (
                      <AdminClubs onClubCreated={(clubId) => {
                        fetchClubs().then(() => {
                          if (clubId) {
                            const club = clubs.find(c => c.id === clubId);
                            if (club) handleSelectClub(club);
                          }
                        });
                      }} />
                    )}
                  </div>
                </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search clubs by name, location, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {filteredClubs.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {userRole === 'super_admin' 
                      ? 'No clubs found. Create your first club to get started.' 
                      : 'You have no clubs yet.'}
                  </p>
                  {(userRole === 'business_owner' || userRole === 'admin') && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                      <Button 
                        onClick={async () => {
                          try {
                            const { data: result, error } = await supabase.functions.invoke(
                              "reconcile-club-owners",
                              { body: { scoped: true } }
                            );
                            if (error) throw error;
                            if (result?.results?.length > 0) {
                              toast({
                                title: "Clubs found!",
                                description: `Linked ${result.results.length} club(s) to your account`,
                              });
                              await fetchClubs();
                            } else {
                              toast({
                                title: "No clubs to fix",
                                description: "You are not listed as an owner of any club",
                              });
                            }
                          } catch (err: any) {
                            toast({
                              title: "Fix failed",
                              description: err.message,
                              variant: "destructive",
                            });
                          }
                        }}
                        variant="outline"
                      >
                        Fix My Club Visibility
                      </Button>
                      <Button onClick={async () => {
                        try {
                          // Create a minimal club for the business owner
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;

                          const { data: profile } = await supabase
                            .from('profiles')
                            .select('name, email')
                            .eq('user_id', user.id)
                            .single();

                          const { data: newClub, error } = await supabase
                            .from('clubs')
                            .insert({
                              name: 'My Club',
                              description: 'New club - please update details',
                              location: '',
                              business_owner_id: user.id,
                              owner_name: profile?.name || '',
                              owner_email: profile?.email || user.email || '',
                            })
                            .select()
                            .single();

                          if (error) {
                            toast({
                              title: "Error",
                              description: "Failed to create club. Please try again.",
                              variant: "destructive",
                            });
                            return;
                          }

                          // Refresh clubs and select the new one
                          await fetchClubs();
                          handleSelectClub(newClub);
                          setActiveSection('details');

                          toast({
                            title: "Success!",
                            description: "Please complete your club details below.",
                          });
                        } catch (err) {
                          console.error('Error creating club:', err);
                          toast({
                            title: "Error",
                            description: "Failed to create club.",
                            variant: "destructive",
                          });
                        }
                      }}>
                        Create Your Club
                      </Button>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredClubs.map((club) => (
                    <Card 
                      key={club.id} 
                      className="hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                      onClick={() => handleSelectClub(club)}
                    >
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={club.image_url || "/placeholder.svg"} 
                          alt={club.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        {club.logo_url && (
                          <div className="absolute bottom-2 left-2">
                            <div className="w-20 h-20 rounded-full bg-white shadow-lg border border-border/20 p-0.5">
                              <img 
                                src={club.logo_url} 
                                alt={`${club.name} logo`}
                                className="w-full h-full object-contain rounded-full"
                              />
                            </div>
                          </div>
                        )}
                        {club.rating && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="bg-white/90 text-foreground">
                              <Star className="w-3 h-3 mr-1 text-warning fill-current" />
                              {club.rating}
                            </Badge>
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="bg-primary/90 text-white">
                            Admin
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {club.name}
                          </h3>
                          <div className="space-y-1">
                            {club.location && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                                <span className="line-clamp-1">{club.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-accent/50 rounded">
                            <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
                            <p className="font-semibold">{club.members_count ?? 0}</p>
                            <p className="text-muted-foreground">Members</p>
                          </div>
                          <div className="p-2 bg-accent/50 rounded">
                            <Dumbbell className="w-4 h-4 mx-auto mb-1 text-primary" />
                            <p className="font-semibold">{club.classes_count ?? 0}</p>
                            <p className="text-muted-foreground">Packages</p>
                          </div>
                          <div className="p-2 bg-accent/50 rounded">
                            <Star className="w-4 h-4 mx-auto mb-1 text-primary" />
                            <p className="font-semibold">{club.trainers_count ?? 0}</p>
                            <p className="text-muted-foreground">Trainers</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Club URL Test Links - Show clubs with slug URLs */}
              {filteredClubs.some(club => club.club_slug && club.country_iso) && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      Club URL Test Links
                    </CardTitle>
                    <CardDescription>
                      Click to test club slug URLs or copy them to share
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredClubs
                        .filter(club => club.club_slug && club.country_iso)
                        .map(club => {
                          const clubUrl = `/club/${club.country_iso.toLowerCase()}/${club.club_slug}`;
                          const fullUrl = `${window.location.origin}${clubUrl}`;
                          const isCopied = copiedUrl === fullUrl;
                          
                          return (
                            <div 
                              key={club.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors group"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {club.logo_url && (
                                  <img 
                                    src={club.logo_url} 
                                    alt={club.name}
                                    className="w-10 h-10 rounded-full object-contain border"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{club.name}</p>
                                  <a
                                    href={clubUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline truncate block"
                                  >
                                    {clubUrl}
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(fullUrl)}
                                  className="flex items-center gap-2"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  asChild
                                >
                                  <a href={clubUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            ) : userRole === 'super_admin' ? (
              <AdminAllMembers />
            ) : null}
          </main>
        </div>
        </div>
      ) : (
        <div className="container px-4 md:px-6">
          <SidebarProvider defaultOpen={true}>
          {/* Mobile Sidebar Trigger - Only visible on mobile */}
          <div className="md:hidden sticky top-16 z-40 bg-background border-b border-border">
            <div className="flex items-center gap-2 p-4">
              <SidebarTrigger />
              <h1 className="font-semibold">{selectedClub.name}</h1>
            </div>
          </div>

            <div className="flex w-full min-h-[calc(100vh-4rem)]">
              <AdminSidebar
                className="top-16 h-[calc(100vh-4rem)]"
                clubId={selectedClubId!}
                clubName={selectedClub.name}
                clubLogoUrl={selectedClub.logo_url}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onExitToClubList={handleBackToClubs}
                userRole={userRole || undefined}
              />
              
              <main className="flex-1 p-6 overflow-auto">
                {activeSection === "dashboard" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">Dashboard Overview</h2>
                      <p className="text-muted-foreground">Welcome to {selectedClub.name} management</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <Card 
                        className="relative overflow-hidden border-primary/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
                        onClick={() => setActiveSection("members")}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-[100px] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-2 relative">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="text-3xl font-bold text-primary">{activeMembersCount}</div>
                          <p className="text-xs text-muted-foreground mt-1">Members with valid packages</p>
                        </CardContent>
                      </Card>
                      
                      <Card 
                        className="relative overflow-hidden border-energy/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
                        onClick={() => setActiveSection("activities")}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-energy/20 to-transparent rounded-bl-[100px] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-2 relative">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Activities</CardTitle>
                            <div className="p-2 rounded-lg bg-energy/10">
                              <Dumbbell className="h-5 w-5 text-energy" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="text-3xl font-bold text-energy">{activitiesCount}</div>
                          <p className="text-xs text-muted-foreground mt-1">Available activities</p>
                        </CardContent>
                      </Card>
                      
                      <Card 
                        className="relative overflow-hidden border-wellness/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
                        onClick={() => setActiveSection("packages")}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-wellness/20 to-transparent rounded-bl-[100px] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-2 relative">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Packages</CardTitle>
                            <div className="p-2 rounded-lg bg-wellness/10">
                              <Building2 className="h-5 w-5 text-wellness" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="text-3xl font-bold text-wellness">{packagesCount}</div>
                          <p className="text-xs text-muted-foreground mt-1">Available packages</p>
                        </CardContent>
                      </Card>
                      
                      <Card 
                        className="relative overflow-hidden border-info/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
                        onClick={() => setActiveSection("instructors")}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-info/20 to-transparent rounded-bl-[100px] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-2 relative">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Trainers</CardTitle>
                            <div className="p-2 rounded-lg bg-info/10">
                              <Users className="h-5 w-5 text-info" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="text-3xl font-bold text-info">{trainersCount}</div>
                          <p className="text-xs text-muted-foreground mt-1">Available trainers</p>
                        </CardContent>
                      </Card>
                      
                      <Card 
                        className="relative overflow-hidden border-warning/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
                        onClick={() => setActiveSection("details")}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-warning/20 to-transparent rounded-bl-[100px] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="pb-2 relative">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Member Rating</CardTitle>
                            <div className="p-2 rounded-lg bg-warning/10">
                              <Star className="h-5 w-5 text-warning" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="flex items-center gap-2">
                            <div className="text-3xl font-bold text-warning">{memberRating.toFixed(1)}</div>
                            <Star className="h-5 w-5 fill-warning text-warning" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Average from reviews</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-primary/20">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-2xl flex items-center gap-2">
                              <TrendingUp className="h-6 w-6 text-primary" />
                              Financial Overview
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Monthly income, expenses, and profit trends ({selectedClub.currency || 'USD'})</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isLoadingTransactions ? (
                          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            Loading financial data...
                          </div>
                        ) : monthlyData.length === 0 ? (
                          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            No financial data available yet. Data will appear as transactions are recorded.
                          </div>
                        ) : (
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart
                            data={monthlyData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            onClick={(data) => {
                              if (data && data.activeLabel) {
                                const currentYear = new Date().getFullYear();
                                setSelectedMonth({ month: data.activeLabel, year: currentYear });
                                setShowMonthTransactions(true);
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="month" 
                              className="text-xs"
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <YAxis 
                              className="text-xs"
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number) => formatCurrency(value, { currency: selectedClub.currency || 'USD' })}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="income" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              dot={{ fill: '#10b981', r: 4 }}
                              activeDot={{ r: 6 }}
                              name="Income"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="expense" 
                              stroke="#ef4444" 
                              strokeWidth={3}
                              dot={{ fill: '#ef4444', r: 4 }}
                              activeDot={{ r: 6 }}
                              name="Expense"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="profit" 
                              stroke="#3b82f6" 
                              strokeWidth={3}
                              dot={{ fill: '#3b82f6', r: 4 }}
                              activeDot={{ r: 6 }}
                              name="Profit"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    {/* Expiring Subscriptions Alert - Moved to bottom */}
                    {selectedClubId && <ExpiringSubscriptionsPanel clubId={selectedClubId} />}
                  </div>
                )}
                {activeSection === "details" && (
                  <AdminClubDetails 
                    clubId={selectedClubId!} 
                    onUpdate={fetchClubs}
                    onClubDeleted={handleBackToClubs}
                  />
                )}
                {activeSection === "gallery" && (
                  <AdminGallery clubId={selectedClubId!} />
                )}
                {activeSection === "facilities" && (
                  <AdminFacilities clubId={selectedClubId!} onUpdate={fetchClubs} />
                )}
                {activeSection === "instructors" && (
                  <AdminInstructors 
                    clubId={selectedClubId!}
                    onUpdate={refreshDashboardData}
                  />
                )}
                {activeSection === "activities" && (
                  <AdminActivities 
                    clubId={selectedClubId!} 
                    clubCurrency={selectedClub.currency || 'USD'}
                    onUpdate={refreshDashboardData}
                  />
                )}
                {activeSection === "packages" && (
                  <AdminPackages 
                    clubId={selectedClubId!} 
                    clubCurrency={selectedClub.currency || 'USD'}
                    onUpdate={refreshDashboardData}
                  />
                )}
                {activeSection === "members" && (
                  <AdminMembers clubId={selectedClubId!} />
                )}
                {activeSection === "financials" && (
                  <AdminFinancials clubId={selectedClubId!} currency={selectedClub.currency || 'USD'} />
                )}
                {activeSection === "messages" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Messages</h2>
                      <p className="text-muted-foreground">Communicate with your members</p>
                    </div>
                    <MessagingPanel clubId={selectedClubId!} isAdmin={true} />
                  </div>
                )}
              </main>
            </div>
          </SidebarProvider>
        </div>
      )}

      {/* Floating Chat Bubble */}
      {openChatId && (
        <FloatingChatBubble
          chat={unreadChats.find(c => c.id === openChatId)!}
          onClose={() => setOpenChatId(null)}
        />
      )}

      {/* Transactions by Month Dialog */}
      {selectedMonth && (
        <TransactionsByMonthDialog
          open={showMonthTransactions}
          onOpenChange={setShowMonthTransactions}
          clubId={selectedClubId!}
          month={selectedMonth.month}
          year={selectedMonth.year}
          currency={selectedClub?.currency || 'USD'}
        />
      )}
    </div>
  );
};

export default Admin;
