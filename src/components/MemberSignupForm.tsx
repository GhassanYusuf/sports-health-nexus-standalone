import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form } from "@/components/ui/form";
import { FormDatePicker } from "@/components/form/FormDatePicker";
import { DatePickerField } from "@/components/form/DatePickerField";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImageCropper } from "./ImageCropper";
import { PhoneInput } from "./PhoneInput";
import { SearchableSelect } from "./SearchableSelect";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Upload, Plus, X, User } from "lucide-react";
import { format } from "date-fns";
import countries from "world-countries";
import { cn } from "@/lib/utils";
import { detectCountryFromIP } from "@/lib/ipDetection";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(5, "Invalid phone number"),
  countryCode: z.string().min(1, "Select country code"),
  dateOfBirth: z.date({ required_error: "Date of birth is required" }),
  gender: z.enum(["male", "female"], { required_error: "Select gender" }),
  nationality: z.string().min(1, "Select nationality"),
  address: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface Child {
  id: string;
  name: string;
  gender: "male" | "female";
  dateOfBirth: Date | null;
  nationality: string;
  avatarFile?: File;
  avatarPreview?: string;
  cropImage?: string;
}

export const MemberSignupForm: React.FC<{
  onSuccess: () => void;
  roleType?: 'user' | 'business_owner';
  compactPhone?: boolean;
}> = ({ onSuccess, roleType = 'user', compactPhone = false }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarUploadedUrl, setAvatarUploadedUrl] = useState<string>("");
  const [currentCropChildId, setCurrentCropChildId] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [childPendingBlobs, setChildPendingBlobs] = useState<Record<string, Blob | null>>({});
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("");

  // Main avatar upload
  const mainAvatarUpload = useImageUpload({
    aspectRatioType: "circle",
    maxOutputSize: 512,
    onSuccess: (url) => {
      setAvatarUploadedUrl(url);
      setAvatarPreview(url);
    },
  });

  // Child avatar upload
  const childAvatarUpload = useImageUpload({
    aspectRatioType: "circle",
    maxOutputSize: 512,
  });

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  // Auto-detect nationality from IP on mount
  useEffect(() => {
    detectCountryFromIP().then((detectedCode) => {
      if (detectedCode) {
        const detectedCountry = countryOptions.find(c => c.code === detectedCode);
        if (detectedCountry) {
          form.setValue("nationality", detectedCountry.name);
        }
      }
    });
  }, []);

  const countryOptions = countries
    .filter((c) => c.cca2 !== "IL") // Exclude Israel
    .map((c) => {
      const callingCode = c.idd.root ? c.idd.root + (c.idd.suffixes?.[0] || "") : "";
      return {
        code: c.cca2,
        name: c.name.common,
        flag: c.flag,
        callingCode,
      };
    })
    .filter((c) => c.callingCode)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // We need a temporary user ID for the upload path
      // We'll use a temp ID that will be replaced after user creation
      const tempUserId = crypto.randomUUID();
      await mainAvatarUpload.handleFileSelect(file, tempUserId, "profile");
    }
  };

  const handleChildImageSelect = async (childId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const tempUserId = crypto.randomUUID();
      setCurrentCropChildId(childId);
      await childAvatarUpload.handleFileSelect(file, tempUserId, `child-${childId}`);
    }
  };

  const handleChildCropComplete = async (blob: Blob) => {
    if (!currentCropChildId) return;

    // Store preview (local) and queue blob for upload after sign-up
    const previewUrl = URL.createObjectURL(blob);
    setChildren((prev) =>
      prev.map((child) =>
        child.id === currentCropChildId ? { ...child, avatarPreview: previewUrl } : child
      )
    );
    setChildPendingBlobs((prev) => ({ ...prev, [currentCropChildId]: blob }));
    setCurrentCropChildId(null);
  };

  const addChild = () => {
    const parentNationality = form.watch("nationality") || "";
    setChildren([...children, { 
      id: crypto.randomUUID(), 
      name: "", 
      gender: "male", 
      dateOfBirth: null,
      nationality: parentNationality 
    }]);
  };

  const removeChild = (id: string) => {
    setChildren(children.filter((c) => c.id !== id));
  };

  // No longer needed - using hook instead

  const onSubmit = async (data: MemberFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Phone number:', phoneNumber);
    console.log('Country code:', countryCode);
    setLoading(true);
    try {
      if (!countryCode || !phoneNumber) {
        console.error('Phone validation failed');
        toast({ title: "Error", description: "Please enter phone number with country code", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Try sending our custom welcome/verification email (Supabase already sends its own)
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            email: data.email,
            token: authData.user.confirmation_sent_at || '',
            type: 'signup'
          }
        });
      } catch (emailError) {
        console.error('Failed to send verification email (custom):', emailError);
        // Do not block the flow if this fails
      }

      // If email confirmation is required, there will be NO session yet.
      // Defer avatar uploads and DB inserts until after the user verifies and signs in.
      if (!authData.session) {
        toast({
          title: "Welcome to TakeOne Family! 🎉",
          description: "Please check your email to verify your account. You must verify before signing in.",
        });
        onSuccess();
        return;
      }

      // If we do have a session (e.g., auto-confirm enabled), proceed to create profile
      // Ensure any pending avatar is uploaded under the authenticated user's folder
      let avatarUrl = avatarUploadedUrl || null;
      try {
        const flushed = await (mainAvatarUpload as any).flushPendingUpload?.(authData.user.id, "profile");
        if (flushed) {
          avatarUrl = flushed;
          setAvatarUploadedUrl(flushed);
        }
      } catch (e) {
        console.error('Avatar flush upload failed:', e);
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: authData.user.id,
        name: data.name,
        avatar_url: avatarUrl,
        phone: phoneNumber,
        country_code: countryCode,
        date_of_birth: format(data.dateOfBirth, "yyyy-MM-dd"),
        gender: data.gender,
        nationality: data.nationality,
        email: data.email,
        address: data.address || null,
      }, {
        onConflict: 'user_id'
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      // Assign role based on signup type using edge function
      console.log(`🎭 Assigning role: ${roleType} to user ${authData.user.id}`);
      try {
        const { data: roleData, error: roleError } = await supabase.functions.invoke('grant-initial-role', {
          body: { role: roleType },
        });

        if (roleError) {
          console.error('Role assignment error:', roleError);
          // Don't throw - role can be assigned later if needed
        } else {
          console.log(`✅ Role ${roleType} assigned successfully:`, roleData);
        }
      } catch (roleErr) {
        console.error('Failed to call grant-initial-role function:', roleErr);
        // Don't block signup if role assignment fails
      }

      for (const child of children) {
        if (!child.name || !child.dateOfBirth) continue;

        let childAvatarUrl: string | null = null;
        const pending = childPendingBlobs[child.id];
        if (pending) {
          try {
            const ext = pending.type === 'image/png' ? 'png' : pending.type === 'image/webp' ? 'webp' : 'jpg';
            const fileName = `${authData.user.id}/child-${child.id}-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('avatars')
              .upload(fileName, pending, { contentType: pending.type, upsert: false });
            if (!upErr) {
              const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
              childAvatarUrl = publicUrl;
            } else {
              console.error('Child avatar upload failed', upErr);
            }
          } catch (e) {
            console.error('Child avatar upload error', e);
          }
        } else if (child.avatarPreview) {
          childAvatarUrl = child.avatarPreview;
        }

        await supabase.from("children").insert({
          parent_user_id: authData.user.id,
          name: child.name,
          gender: child.gender,
          date_of_birth: format(child.dateOfBirth, "yyyy-MM-dd"),
          avatar_url: childAvatarUrl,
          nationality: child.nationality || form.watch("nationality"),
        });
      }

      toast({
        title: "Welcome to TakeOne Family! 🎉",
        description: "Your account is ready!",
      });
      onSuccess();
    } catch (err) {
      console.error('Signup error details:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create account";
      console.error('Error message:', errorMessage);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const nationalityOptions = countryOptions.map(c => ({
    value: c.code,
    label: c.name,
    icon: c.flag,
  }));

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full max-w-4xl mx-auto">
        <div className="text-center space-y-2 px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Join Our Fitness Community</h2>
          <p className="text-sm md:text-base text-muted-foreground">Fill in your details to get started on your fitness journey</p>
        </div>

        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-3 px-4 py-2">
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-muted-foreground" />
            )}
          </div>
          <Label htmlFor="avatar" className="cursor-pointer">
            <div className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              <Upload className="w-4 h-4" />
              Upload Profile Picture (Optional)
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Click to upload, then crop, zoom, and rotate
            </p>
            <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </Label>
        </div>

        <div className="space-y-6 bg-card p-4 md:p-6 lg:p-8 rounded-lg border shadow-sm mx-2 md:mx-4">
          <h3 className="text-base md:text-lg font-semibold">Personal Information</h3>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" placeholder="John Doe" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" placeholder="john@example.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <PhoneInput
                countryCode={countryCode}
                phoneNumber={phoneNumber}
                onCountryCodeChange={(v) => { setCountryCode(v); form.setValue("countryCode", v, { shouldValidate: true }); }}
                onPhoneNumberChange={(v) => { setPhoneNumber(v); form.setValue("phone", v, { shouldValidate: true }); }}
                compact={compactPhone}
              />
              <input type="hidden" {...form.register("phone")} value={phoneNumber} />
              <input type="hidden" {...form.register("countryCode")} value={countryCode} />
              {(form.formState.errors.phone || form.formState.errors.countryCode) && (
                <p className="text-sm text-destructive">Please enter a valid phone and country code</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" placeholder="Min. 6 characters" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <FormDatePicker
              control={form.control}
              name="dateOfBirth"
              label="Date of Birth"
              placeholder="Select your birthdate"
              required
              maxDate={new Date()}
              minDate={new Date("1900-01-01")}
            />

            <div className="space-y-2">
              <Label>Gender *</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => form.setValue("gender", "male", { shouldValidate: true })}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 px-4 rounded-md border-2 transition-all font-medium",
                    form.watch("gender") === "male"
                      ? "bg-blue-500 border-blue-600 text-white shadow-sm"
                      : "bg-background border-input hover:border-blue-300 text-foreground"
                  )}
                >
                  <User className="w-4 h-4" />
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("gender", "female", { shouldValidate: true })}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 px-4 rounded-md border-2 transition-all font-medium",
                    form.watch("gender") === "female"
                      ? "bg-pink-500 border-pink-600 text-white shadow-sm"
                      : "bg-background border-input hover:border-pink-300 text-foreground"
                  )}
                >
                  <User className="w-4 h-4" />
                  Female
                </button>
              </div>
              {form.formState.errors.gender && (
                <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label>Nationality *</Label>
              <SearchableSelect
                value={form.watch("nationality") || ""}
                onValueChange={(v) => form.setValue("nationality", v, { shouldValidate: true })}
                options={nationalityOptions}
                placeholder="Select your nationality"
                searchPlaceholder="Search countries..."
                emptyMessage="No country found."
              />
              {form.formState.errors.nationality && (
                <p className="text-sm text-destructive">{form.formState.errors.nationality.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            {!showAddress && (
              <Button type="button" variant="outline" onClick={() => setShowAddress(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </Button>
            )}

            {showAddress && (
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" {...form.register("address")} placeholder="Enter your full address" rows={3} />
              </div>
            )}
          </div>

          {/* Children Section */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h4 className="font-semibold text-base md:text-lg">Children (Optional)</h4>
              <Button type="button" variant="default" size="sm" onClick={addChild} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Child
              </Button>
            </div>

            {children.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No children added yet. Click "Add Child" to register your children.</p>
            )}

            <div className="space-y-4">
              {children.map((child, idx) => (
                <Card key={child.id} className="shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-base">Child {idx + 1}</h4>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeChild(child.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden border-2 border-background shadow">
                        {child.avatarPreview ? (
                          <img src={child.avatarPreview} alt="Child" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <Label htmlFor={`child-avatar-${child.id}`} className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                        Upload Picture
                      </Label>
                      <Input
                        id={`child-avatar-${child.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleChildImageSelect(child.id, e)}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          placeholder="Child's name"
                          value={child.name}
                          onChange={(e) =>
                            setChildren((prev) =>
                              prev.map((c) => (c.id === child.id ? { ...c, name: e.target.value } : c))
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <RadioGroup
                          value={child.gender}
                          onValueChange={(v) =>
                            setChildren((prev) =>
                              prev.map((c) => (c.id === child.id ? { ...c, gender: v as "male" | "female" } : c))
                            )
                          }
                          className="flex gap-4 pt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id={`child-male-${child.id}`} />
                            <Label htmlFor={`child-male-${child.id}`} className="cursor-pointer font-normal">👦 Boy</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id={`child-female-${child.id}`} />
                            <Label htmlFor={`child-female-${child.id}`} className="cursor-pointer font-normal">👧 Girl</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label>Date of Birth</Label>
                        <DatePickerField
                          value={child.dateOfBirth || undefined}
                          onSelect={(date) =>
                            setChildren((prev) =>
                              prev.map((c) => (c.id === child.id ? { ...c, dateOfBirth: date || null } : c))
                            )
                          }
                          placeholder="Pick date"
                          maxDate={new Date()}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Nationality</Label>
                        <SearchableSelect
                          value={child.nationality}
                          onValueChange={(v) =>
                            setChildren((prev) =>
                              prev.map((c) => (c.id === child.id ? { ...c, nationality: v } : c))
                            )
                          }
                          options={nationalityOptions}
                          placeholder="Select nationality"
                          searchPlaceholder="Search countries..."
                          emptyMessage="No country found."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>


        <div className="px-2 md:px-4">
          <Button 
            type="submit" 
            disabled={loading} 
            size="lg" 
            className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-brand-red hover:bg-brand-red-dark"
            onClick={() => console.log('Button clicked', { 
              formState: form.formState, 
              errors: form.formState.errors,
              isValid: form.formState.isValid 
            })}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Creating Your Account...
              </span>
            ) : "Create Account"}
          </Button>
        </div>
      </form>
      </Form>

      {mainAvatarUpload.imageToEdit && (
        <ImageCropper 
          image={mainAvatarUpload.imageToEdit} 
          aspectRatioType="circle"
          maxOutputSize={512}
          onCropComplete={mainAvatarUpload.handleCropComplete} 
          onClose={mainAvatarUpload.handleCloseCropper} 
        />
      )}
      
      {childAvatarUpload.imageToEdit && currentCropChildId && (
        <ImageCropper 
          image={childAvatarUpload.imageToEdit} 
          aspectRatioType="circle"
          maxOutputSize={512}
          onCropComplete={handleChildCropComplete} 
          onClose={() => {
            childAvatarUpload.handleCloseCropper();
            setCurrentCropChildId(null);
          }} 
        />
      )}
    </>
  );
};
