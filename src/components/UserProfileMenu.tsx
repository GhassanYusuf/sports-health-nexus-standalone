import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Users, Baby, Settings as SettingsIcon, LogOut, Building2, Shield, MessageSquare } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

interface UserProfile {
  name: string;
  avatar_url: string | null;
  email: string | null;
}

export function UserProfileMenu() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasChildren, setHasChildren] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchUserData();

    // Listen for auth state changes (sign out, sign in, etc)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out - clearing profile');
        setProfile(null);
        setUserRole(null);
        setHasChildren(false);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        console.log('👤 User signed in/updated - fetching data');
        // Don't reset loading if we already have a profile (prevents flash)
        if (!profile) {
          setIsLoading(true);
        }
        // Fetch immediately
        fetchUserData();
      } else if (session?.user) {
        console.log('👤 Session active - fetching data');
        // Don't reset loading if we already have a profile (prevents flash)
        if (!profile) {
          setIsLoading(true);
        }
        fetchUserData();
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('❌ No user found - not fetching profile');
      setProfile(null);
      setUserRole(null);
      setHasChildren(false);
      setIsLoading(false);
      return;
    }

    console.log('📡 Fetching profile for user:', user.id);

    // Fetch all data in parallel
    const [profileResult, roleResult, childrenResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('name, avatar_url, email')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .order('role')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('parent_user_id', user.id)
    ]);

    // Update all state at once to prevent flash
    if (profileResult.data) {
      console.log('✅ Profile fetched:', profileResult.data.name);
      setProfile(profileResult.data);
    } else {
      console.log('⚠️ No profile data found');
      setProfile(null);
    }

    if (roleResult.data) {
      setUserRole(roleResult.data.role);
    }

    setHasChildren((childrenResult.count ?? 0) > 0);
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    console.log('🔴 Sign out clicked');
    await supabase.auth.signOut();
    console.log('✅ Sign out completed');
    navigate("/");
    console.log('🔄 Navigating to home');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Show nothing while loading to avoid flash
  if (isLoading) {
    return (
      <div className="h-10 w-20 bg-muted animate-pulse rounded-md" />
    );
  }

  // Show Sign In button only after loading is complete and no profile found
  if (!profile) {
    return (
      <Button
        onClick={() => navigate("/auth")}
        className="bg-brand-red hover:bg-brand-red-dark"
      >
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-border">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.name} />
            <AvatarFallback className="bg-brand-red text-white">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>My Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/affiliations")}>
          <Users className="mr-2 h-4 w-4" />
          <span>Affiliations</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/messages")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>Messages</span>
        </DropdownMenuItem>
        {hasChildren && (
          <DropdownMenuItem onClick={() => navigate("/my-children")}>
            <Baby className="mr-2 h-4 w-4" />
            <span>My Children</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(userRole === 'business_owner' || userRole === 'admin') && (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Building2 className="mr-2 h-4 w-4" />
            <span>Manage My Club</span>
          </DropdownMenuItem>
        )}
        {userRole === 'super_admin' && (
          <>
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          </>
        )}
        {(userRole === 'super_admin' || userRole === 'business_owner' || userRole === 'admin') && (
          <DropdownMenuSeparator />
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
