import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropper } from "@/components/ImageCropper";

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "avatar",
    maxOutputSize: 512,
    bucket: "avatars",
    onSuccess: async (url) => {
      console.log('Avatar uploaded successfully, URL:', url);

      // Update profile with new avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('user_id', profile.user_id);

      if (error) {
        console.error('Failed to update avatar in DB:', error);
        toast({
          title: "Error",
          description: "Failed to update avatar",
          variant: "destructive",
        });
      } else {
        console.log('Avatar URL saved to database');
        // Force re-fetch profile to ensure we have the latest data
        await fetchProfile();
        toast({
          title: "Success",
          description: "Profile photo updated successfully",
        });
      }
    },
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await handleFileSelect(file, user.id, 'avatar');
  };

  const fetchProfile = async () => {
    console.log('🔄 Fetching profile...');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('❌ No user found, redirecting to /auth');
      navigate("/auth");
      return;
    }

    console.log('👤 User ID:', user.id);

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      console.log('✅ Profile loaded:', data.name);
      setProfile(data);
    } else {
      console.log('⚠️ No profile data found');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    console.log('💾 Saving profile...');
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
          country_code: profile.country_code,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          nationality: profile.nationality,
          address: profile.address,
          blood_type: profile.blood_type,
        })
        .eq('user_id', profile.user_id);

      if (error) {
        console.error('❌ Profile save error:', error);
        toast({
          title: "Error",
          description: "Failed to update profile",
          variant: "destructive",
        });
      } else {
        console.log('✅ Profile saved successfully');
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });

        // Redirect to home page after successful save
        setTimeout(() => {
          navigate('/');
        }, 1000); // Wait 1 second to show the toast
      }
    } catch (err) {
      console.error('❌ Unexpected error saving profile:', err);
    } finally {
      setSaving(false);
      console.log('💾 Save complete');
    }
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">My Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  key={profile?.avatar_url}
                  src={profile?.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : undefined}
                />
                <AvatarFallback className="bg-brand-red text-white text-2xl">
                  {profile?.name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {isUploading ? 'Uploading...' : 'Change Photo'}
              </Button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={profile?.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Read-only)</Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profile?.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country_code">Country Code</Label>
                <Input
                  id="country_code"
                  value={profile?.country_code || ''}
                  onChange={(e) => setProfile({ ...profile, country_code: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={profile?.date_of_birth || ''}
                  onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Input
                  id="gender"
                  value={profile?.gender || ''}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={profile?.nationality || ''}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blood_type">Blood Type</Label>
                <Input
                  id="blood_type"
                  value={profile?.blood_type || ''}
                  onChange={(e) => setProfile({ ...profile, blood_type: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={profile?.address || ''}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Cropper Modal */}
      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          onCropComplete={handleCropComplete}
          onClose={handleCloseCropper}
          aspectRatioType={aspectRatioType}
          maxOutputSize={maxOutputSize}
        />
      )}
    </div>
  );
}
