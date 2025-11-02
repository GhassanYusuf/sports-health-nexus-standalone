import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MemberSignupForm } from "@/components/MemberSignupForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import takeOneLogo from "@/assets/takeone-logo.png";

type SignupStep = "profile" | "club-info" | "complete";

const ClubOwnerSignup: React.FC = () => {
  const [step, setStep] = useState<SignupStep>("profile");
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 ClubOwnerSignup - Checking session:', session?.user?.id);
      if (session?.user) {
        setUserId(session.user.id);
        // Check if they already have admin role
        checkAdminRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 ClubOwnerSignup - Auth changed:', event, session?.user?.id);
      if (session?.user && event === 'SIGNED_IN') {
        setUserId(session.user.id);
        setStep("club-info");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (uid: string) => {
    console.log('🔍 Checking admin role for user:', uid);

    // Check if user already has a club
    const { data: clubData } = await supabase
      .from("clubs")
      .select("id")
      .eq("business_owner_id", uid)
      .maybeSingle();

    if (clubData) {
      // User already owns a club, redirect to admin
      console.log('✅ User already owns a club, redirecting to /admin');
      navigate("/admin");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();

    console.log('👤 User role:', data?.role);

    if (data?.role === "admin" || data?.role === "super_admin") {
      // Has admin/super_admin role, redirect to admin
      console.log('✅ User has admin role, redirecting to /admin');
      navigate("/admin");
    } else if (data?.role === "business_owner") {
      // Has business_owner role but no club yet, go to club-info
      console.log('📝 User is business_owner, moving to club-info to create club');
      setStep("club-info");
    } else {
      // User is signed in (with "user" role, no role, or any other role)
      // Skip to club-info to upgrade to business_owner
      console.log('📝 User is signed in, moving to club-info to become business owner');
      setStep("club-info");
    }
  };

  const handleProfileComplete = () => {
    setStep("club-info");
  };

  const handleClubCreated = async (clubId: string) => {
    if (userId) {
      try {
        console.log('🏢 Creating club for user:', userId, 'clubId:', clubId);

        // Grant business_owner role using edge function
        console.log('👑 Granting business_owner role...');
        const { data: roleResponse, error: roleError } = await supabase.functions.invoke('grant-initial-role', {
          body: { role: 'business_owner' },
        });

        if (roleError) {
          console.error('❌ Failed to grant business_owner role:', roleError);
          throw new Error(`Failed to grant business_owner role: ${roleError.message}`);
        }

        console.log('✅ Business_owner role response:', roleResponse);

        // Update club with business_owner_id (if real club ID provided)
        if (clubId !== "temp-club-id") {
          console.log('🔄 Updating club with business_owner_id...');
          const { error: updateError } = await supabase
            .from("clubs")
            .update({ business_owner_id: userId })
            .eq("id", clubId);

          if (updateError) {
            console.error('❌ Club update error:', updateError);
            throw updateError;
          }
          console.log('✅ Club updated successfully');
        } else {
          console.log('⏩ Skipping club update (temp-club-id) - user will create club in admin panel');
        }

        toast({
          title: "Success!",
          description: "You're all set! You can now create your club in the admin dashboard.",
        });

        console.log('✅ Setup complete, moving to complete step');
        setStep("complete");

        // Redirect to admin dashboard
        setTimeout(() => {
          console.log('🔄 Redirecting to /admin');
          navigate("/admin");
        }, 2000);
      } catch (err) {
        console.error("❌ Error setting up business owner:", err);
        toast({
          title: "Error",
          description: "There was an issue setting up your account. Please contact support.",
          variant: "destructive",
        });
      }
    } else {
      console.error('❌ No userId available');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <img src={takeOneLogo} alt="TakeOne" className="h-8" />
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "profile" ? "bg-primary text-primary-foreground" : 
                step === "club-info" || step === "complete" ? "bg-green-500 text-white" : 
                "bg-muted text-muted-foreground"
              }`}>
                {step === "club-info" || step === "complete" ? <CheckCircle2 className="h-5 w-5" /> : "1"}
              </div>
              <span className="text-sm font-medium">Your Profile</span>
            </div>
            
            <div className="w-12 h-0.5 bg-muted" />
            
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "club-info" ? "bg-primary text-primary-foreground" : 
                step === "complete" ? "bg-green-500 text-white" : 
                "bg-muted text-muted-foreground"
              }`}>
                {step === "complete" ? <CheckCircle2 className="h-5 w-5" /> : "2"}
              </div>
              <span className="text-sm font-medium">Club Info</span>
            </div>
            
            <div className="w-12 h-0.5 bg-muted" />
            
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "complete" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {step === "complete" ? <CheckCircle2 className="h-5 w-5" /> : "3"}
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>

          {/* Step Content */}
          {step === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Create Your Profile</CardTitle>
                <CardDescription>
                  First, let's set up your personal account as a club owner
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MemberSignupForm
                  onSuccess={handleProfileComplete}
                  roleType="business_owner"
                  compactPhone={true}
                />
              </CardContent>
            </Card>
          )}

          {step === "club-info" && (
            <Card>
              <CardHeader>
                <CardTitle>Create Your Club</CardTitle>
                <CardDescription>
                  Now let's add your club's basic information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  You'll be able to complete your club's full details in the admin dashboard.
                </p>
                <Button onClick={() => {
                  // For now, just create a placeholder and grant access
                  handleClubCreated("temp-club-id");
                }} className="w-full">
                  Continue to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "complete" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Welcome to TakeOne!
                </CardTitle>
                <CardDescription>
                  Your account has been created successfully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  You now have access to your club management dashboard where you can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Complete your club's detailed information</li>
                  <li>Add facilities, amenities, and packages</li>
                  <li>Manage members and instructors</li>
                  <li>Track club statistics and performance</li>
                </ul>
                <Button onClick={() => navigate("/admin")} className="w-full">
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClubOwnerSignup;
