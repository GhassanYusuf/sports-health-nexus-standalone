import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { MemberSignupForm } from "@/components/MemberSignupForm";
import { ArrowLeft, Mail, Lock, Phone } from "lucide-react";
import takeOneLogo from "@/assets/takeone-logo.png";

const Auth: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "update-password">("signin");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginStep, setLoginStep] = useState<"identifier" | "password">("identifier");
  const [userProfile, setUserProfile] = useState<{ avatar_url: string | null; name: string } | null>(null);
  const [isClubOwner, setIsClubOwner] = useState(false);

  // Get URL params for return URL and package selection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'signup') {
      setMode('signup');
    } else if (modeParam === 'update-password') {
      setMode('update-password');
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        return;
      }
      if (session?.user && event === 'SIGNED_IN') {
        // Don't redirect if we're in password recovery mode
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');

        if (modeParam === 'update-password') {
          return; // Stay on password reset form
        }

        const returnUrl = params.get('returnUrl');
        const packageId = params.get('packageId');

        if (returnUrl) {
          // Navigate back with package selection
          navigate(`${returnUrl}${packageId ? `?packageId=${packageId}` : ''}`);
        } else {
          navigate("/");
        }
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');

        // Don't redirect if we're in password recovery mode
        if (modeParam === 'update-password') {
          return;
        }

        const returnUrl = params.get('returnUrl');
        if (returnUrl) {
          navigate(returnUrl);
        } else {
          navigate("/");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Lookup profile via secure RPC (works without auth)
      const { data: profileData, error: profileError } = await supabase
        .rpc('lookup_profile_for_login', { identifier: email })
        .maybeSingle();

      if (profileError || !profileData) {
        throw new Error('Account not found. Please check your email or phone.');
      }

      // Get role via secure RPC
      const { data: roleText } = await (supabase as any).rpc('get_user_role_for_login', { p_user_id: profileData.user_id });

      setIsClubOwner(roleText === 'admin' || roleText === 'super_admin');
      setUserProfile(profileData as any);
      
      // CRITICAL FIX: Store the actual email from profile for authentication
      // This ensures signInWithPassword receives email even if user entered phone
      setEmail(profileData.email);
      
      setLoginStep('password');
    } catch (err) {
      toast({ 
        title: "Account not found", 
        description: err instanceof Error ? err.message : "Please check your credentials and try again.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=update-password`,
        });
        if (error) throw error;
        toast({ 
          title: "Check your email", 
          description: "We've sent you a password reset link." 
        });
        setMode("signin");
      } else if (mode === "update-password") {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
        toast({ 
          title: "Password updated", 
          description: "Your password has been successfully reset. Please sign in with your new password." 
        });
        navigate("/auth");
      } else if (mode === "signup") {
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl') || '/';
        const packageId = params.get('packageId');
        const fullReturnUrl = `${window.location.origin}${returnUrl}${packageId ? `?packageId=${packageId}` : ''}`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: fullReturnUrl },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your address to finish signup." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back", description: "Signed in successfully." });
        // Navigation handled by onAuthStateChange
      }
    } catch (err) {
      toast({ title: "Auth error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8 bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>
      
      <Card className={`w-full ${mode === 'signup' ? 'max-w-5xl' : 'max-w-md'} relative shadow-2xl backdrop-blur-xl bg-card/95 border-2 border-border/50 transition-all`}>
        <CardHeader className="space-y-6 pb-6 pt-8">
          {/* Logo/Avatar Section */}
          <div className="flex justify-center">
            {mode === "signin" && loginStep === "identifier" && (
              <img 
                src={takeOneLogo} 
                alt="TakeOne Logo" 
                className="h-16 w-auto drop-shadow-lg"
              />
            )}
            {mode === "signin" && loginStep === "password" && (
              <div className="relative">
                {isClubOwner ? (
                  <img 
                    src={takeOneLogo} 
                    alt="TakeOne Logo" 
                    className="h-16 w-auto drop-shadow-lg"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ring-4 ring-background shadow-xl">
                      {userProfile?.avatar_url ? (
                        <img 
                          src={userProfile.avatar_url} 
                          alt={userProfile.name} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                          {userProfile?.name?.[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                    </div>
                )}
              </div>
            )}
          </div>

          {/* Title & Description */}
          <div className="text-center space-y-2 relative">
            {mode === "reset" && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setMode("signin")}
                className="h-8 w-8 absolute -left-2 -top-2 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {(mode !== "signin" || loginStep !== "identifier") && (
              <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {mode === "reset" 
                  ? "Reset Password" 
                  : mode === "update-password" 
                  ? "Set New Password" 
                  : mode === "signin" 
                  ? (userProfile?.name 
                    ? `Hello, ${userProfile.name.split(' ')[0]}!` 
                    : "Welcome back!")
                  : "Join Us"}
              </CardTitle>
            )}
            <CardDescription className="text-base">
              {mode === "signin" && loginStep === "password" && userProfile?.name && (
                <span className="block text-xs text-muted-foreground mb-2">
                  Signing in as {userProfile.name}
                </span>
              )}
              {mode === "reset" 
                ? "We'll send you a secure link to reset your password" 
                : mode === "update-password"
                ? "Choose a strong password to protect your account"
                : mode === "signin" 
                ? (loginStep === "identifier" 
                  ? "Sign in to access your account" 
                  : "Enter your password to continue")
                : "Create your account to get started"}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 px-8 pb-8">
          {mode === "update-password" ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-primary" />
                  New Password
                </Label>
                <Input 
                  id="new-password"
                  type="password" 
                  placeholder="Enter your new password"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  minLength={6}
                  className="h-12 text-base transition-all focus:shadow-glow focus:border-primary"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all text-base font-semibold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Updating...
                  </span>
                ) : "Update Password"}
              </Button>
            </form>
          ) : mode === "signin" ? (
            <>
              {loginStep === "identifier" ? (
                <form onSubmit={handleIdentifierSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-4 w-4 text-primary" />
                      <Phone className="h-4 w-4 text-primary" />
                      Email or Phone
                    </Label>
                    <Input 
                      id="identifier"
                      type="text" 
                      placeholder="name@example.com or 33791210"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="h-12 text-base transition-all focus:shadow-glow focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter your email address or phone number (without country code)
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all text-base font-semibold disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Verifying account...
                      </span>
                    ) : "Continue"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5">
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setLoginStep("identifier");
                      setUserProfile(null);
                      setPassword("");
                    }}
                    className="-mt-2 mb-1 h-9 text-sm hover:bg-muted"
                  >
                    <ArrowLeft className="h-3 w-3 mr-2" />
                    Change account
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4 text-primary" />
                      Password
                    </Label>
                    <Input 
                      id="password"
                      type="password" 
                      placeholder="Enter your password"
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="h-12 text-base transition-all focus:shadow-glow focus:border-primary"
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setLoginStep("identifier");
                      }}
                      className="text-sm text-primary hover:text-primary/80 font-medium transition-all"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all text-base font-semibold"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Signing in...
                      </span>
                    ) : "Sign In"}
                  </Button>
                </form>
              )}
              
              {loginStep === "identifier" && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-3 text-muted-foreground font-medium">
                        Don't have an account?
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setMode("signup")}
                    className="w-full h-11 border-2 hover:bg-muted hover:border-primary/50 transition-all"
                  >
                    Create Account
                  </Button>
                </>
              )}
            </>
          ) : mode === "reset" ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </Label>
                <Input 
                  id="reset-email"
                  type="email" 
                  placeholder="name@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="h-12 text-base transition-all focus:shadow-glow focus:border-primary"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all text-base font-semibold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </span>
                ) : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <>
              <MemberSignupForm
                onSuccess={() => navigate("/")}
                roleType="user"
              />
              
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Already have an account?
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setMode("signin")}
                className="w-full"
              >
                Sign In
              </Button>
            </>
          )}
          
          <div className="pt-6 text-center border-t border-border/50">
            <Link 
              to="/" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2 font-medium group"
            >
              <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
