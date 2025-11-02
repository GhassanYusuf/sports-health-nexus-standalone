import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, ArrowLeft, ArrowRight, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropper } from "@/components/ImageCropper";
import LeafletLocationMap from "@/components/LeafletLocationMap";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import countries from "world-countries";

interface AdminClubsProps {
  onClubCreated?: (clubId: string) => void;
}

type Step = "club-info" | "owner-choice" | "create-owner" | "link-owner";

export const AdminClubs: React.FC<AdminClubsProps> = ({ onClubCreated }) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("club-info");
  const [ownerChoice, setOwnerChoice] = useState<"create" | "link">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [clubData, setClubData] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    map_zoom: 13,
  });

  const [ownerData, setOwnerData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    country_code: "+1",
    gender: "male" as "male" | "female",
    date_of_birth: undefined as Date | undefined,
    nationality: "",
    address: "",
    blood_type: "",
  });

  const [existingUserId, setExistingUserId] = useState("");
  const [allUsers, setAllUsers] = useState<Array<{ user_id: string; name: string; email: string }>>([]);

  const {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "cover",
    maxOutputSize: 1920,
    bucket: "avatars",
    onSuccess: (url) => {
      setClubData({ ...clubData, image_url: url });
    },
  });

  const countryOptions = countries
    .filter((c) => c.cca2 !== "IL")
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

  const nationalityOptions = countryOptions.map(c => ({
    value: c.name,
    label: c.name,
    icon: c.flag,
  }));

  // Load existing users when dialog opens
  useEffect(() => {
    if (isDialogOpen && currentStep === "link-owner") {
      loadUsers();
    }
  }, [isDialogOpen, currentStep]);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, email")
      .order("name");
    
    if (!error && data) {
      setAllUsers(data);
    }
  };

  const resetForm = () => {
    setClubData({
      name: "",
      description: "",
      location: "",
      image_url: "",
      latitude: undefined,
      longitude: undefined,
      map_zoom: 13,
    });
    setOwnerData({
      name: "",
      email: "",
      password: "",
      phone: "",
      country_code: "+1",
      gender: "male",
      date_of_birth: undefined,
      nationality: "",
      address: "",
      blood_type: "",
    });
    setExistingUserId("");
    setCurrentStep("club-info");
    setOwnerChoice("create");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast({ title: "Please sign in to upload images", variant: "destructive" });
      return;
    }

    await handleFileSelect(file, userId, "club-banner");
  };

  const validateClubInfo = () => {
    if (!clubData.name.trim()) {
      toast({ title: "Club name is required", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateOwnerInfo = () => {
    if (!ownerData.name || !ownerData.email || !ownerData.password || !ownerData.phone || !ownerData.date_of_birth || !ownerData.nationality) {
      toast({ title: "Please fill all required owner fields", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === "club-info") {
      if (!validateClubInfo()) return;
      setCurrentStep("owner-choice");
    } else if (currentStep === "owner-choice") {
      if (ownerChoice === "create") {
        setCurrentStep("create-owner");
      } else {
        setCurrentStep("link-owner");
      }
    }
  };

  const handleBack = () => {
    if (currentStep === "create-owner" || currentStep === "link-owner") {
      setCurrentStep("owner-choice");
    } else if (currentStep === "owner-choice") {
      setCurrentStep("club-info");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let ownerId: string;

      // Step 1: Create or get owner
      if (ownerChoice === "create") {
        if (!validateOwnerInfo()) {
          setIsSubmitting(false);
          return;
        }

        // Create new member
        const { data: memberData, error: memberError } = await supabase.functions.invoke("create-member", {
          body: {
            email: ownerData.email,
            password: ownerData.password,
            name: ownerData.name,
            phone: ownerData.phone,
            country_code: ownerData.country_code,
            gender: ownerData.gender,
            date_of_birth: format(ownerData.date_of_birth!, "yyyy-MM-dd"),
            nationality: ownerData.nationality,
            address: ownerData.address || undefined,
            blood_type: ownerData.blood_type || undefined,
          },
        });

        if (memberError || memberData?.error) {
          throw new Error(memberError?.message || memberData?.error || "Failed to create member");
        }

        ownerId = memberData.user_id;
        toast({ title: "Owner member created successfully" });
      } else {
        // Use existing user
        if (!existingUserId) {
          toast({ title: "Please select an existing user", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        ownerId = existingUserId;
      }

      // Step 2: Create club
      const { data: clubResult, error: clubError } = await supabase
        .from("clubs")
        .insert({
          name: clubData.name.trim(),
          description: clubData.description.trim() || null,
          location: clubData.location.trim() || null,
          image_url: clubData.image_url.trim() || null,
          gps_latitude: clubData.latitude,
          gps_longitude: clubData.longitude,
          map_zoom: clubData.map_zoom,
        })
        .select();

      if (clubError) throw clubError;

      const newClubId = clubResult[0]?.id;

      // Step 3: Link owner to club
      const { data: ownerLinkData, error: ownerLinkError } = await supabase.functions.invoke("create-club-owner", {
        body: {
          user_id: ownerId,
          club_id: newClubId,
        },
      });

      if (ownerLinkError || ownerLinkData?.error) {
        toast({ 
          title: "Club created but owner linking failed", 
          description: ownerLinkError?.message || ownerLinkData?.error,
          variant: "destructive" 
        });
      } else {
        toast({ title: "Club and owner created successfully!" });
      }

      setIsDialogOpen(false);
      resetForm();

      if (onClubCreated) {
        onClubCreated(newClubId || "");
      }
    } catch (err) {
      console.error("Error creating club:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create club",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderClubInfoStep = () => (
    <div className="space-y-4">
      <div>
        <Label>Club Name *</Label>
        <Input
          value={clubData.name}
          onChange={(e) => setClubData({ ...clubData, name: e.target.value })}
          placeholder="Enter club name"
        />
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea
          value={clubData.description}
          onChange={(e) => setClubData({ ...clubData, description: e.target.value })}
          rows={3}
          placeholder="Enter club description"
        />
      </div>

      <div>
        <Label>Banner Image</Label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="flex-1"
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
          {clubData.image_url && (
            <img src={clubData.image_url} alt="Preview" className="w-full h-32 object-cover rounded" />
          )}
        </div>
      </div>

      <div>
        <Label>Location Address</Label>
        <Input
          value={clubData.location}
          onChange={(e) => setClubData({ ...clubData, location: e.target.value })}
          placeholder="e.g., 123 Main St, City"
        />
      </div>

      <div>
        <Label>Club Location (Drag marker to set)</Label>
        <LeafletLocationMap
          latitude={clubData.latitude}
          longitude={clubData.longitude}
          zoom={clubData.map_zoom}
          onLocationChange={(lat, lng) => {
            setClubData({ ...clubData, latitude: lat, longitude: lng });
          }}
          onZoomChange={(zoom) => {
            setClubData({ ...clubData, map_zoom: zoom });
          }}
          onAddressChange={(address) => {
            setClubData({ ...clubData, location: address });
          }}
          height={300}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {clubData.latitude && clubData.longitude 
            ? `Lat: ${clubData.latitude.toFixed(6)}, Lng: ${clubData.longitude.toFixed(6)}`
            : 'Detecting your location...'}
        </p>
      </div>
    </div>
  );

  const renderOwnerChoiceStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose how to assign the club owner:</p>
      <RadioGroup value={ownerChoice} onValueChange={(v) => setOwnerChoice(v as "create" | "link")}>
        <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent cursor-pointer">
          <RadioGroupItem value="create" id="create" />
          <Label htmlFor="create" className="cursor-pointer flex-1">
            <div className="font-semibold">Create New Member</div>
            <div className="text-sm text-muted-foreground">Register a new member as the club owner</div>
          </Label>
        </div>
        <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent cursor-pointer">
          <RadioGroupItem value="link" id="link" />
          <Label htmlFor="link" className="cursor-pointer flex-1">
            <div className="font-semibold">Link Existing Member</div>
            <div className="text-sm text-muted-foreground">Assign an existing platform member as owner</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );

  const renderCreateOwnerStep = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      <p className="text-sm text-muted-foreground">Enter the owner's information to create their member account:</p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Full Name *</Label>
          <Input
            value={ownerData.name}
            onChange={(e) => setOwnerData({ ...ownerData, name: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={ownerData.email}
            onChange={(e) => setOwnerData({ ...ownerData, email: e.target.value })}
            placeholder="owner@example.com"
          />
        </div>

        <div>
          <Label>Password *</Label>
          <Input
            type="password"
            value={ownerData.password}
            onChange={(e) => setOwnerData({ ...ownerData, password: e.target.value })}
            placeholder="Min. 6 characters"
          />
        </div>

        <div className="col-span-2">
          <Label>Phone Number *</Label>
          <PhoneInput
            countryCode={ownerData.country_code}
            phoneNumber={ownerData.phone}
            onCountryCodeChange={(code) => setOwnerData({ ...ownerData, country_code: code })}
            onPhoneNumberChange={(phone) => setOwnerData({ ...ownerData, phone })}
          />
        </div>

        <div className="col-span-2">
          <Label>Gender *</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setOwnerData({ ...ownerData, gender: "male" })}
              className={cn(
                "flex items-center justify-center gap-2 h-10 px-4 rounded-md border-2 transition-all font-medium",
                ownerData.gender === "male"
                  ? "bg-blue-500 border-blue-600 text-white shadow-sm"
                  : "bg-background border-input hover:border-blue-300"
              )}
            >
              <User className="w-4 h-4" />
              Male
            </button>
            <button
              type="button"
              onClick={() => setOwnerData({ ...ownerData, gender: "female" })}
              className={cn(
                "flex items-center justify-center gap-2 h-10 px-4 rounded-md border-2 transition-all font-medium",
                ownerData.gender === "female"
                  ? "bg-pink-500 border-pink-600 text-white shadow-sm"
                  : "bg-background border-input hover:border-pink-300"
              )}
            >
              <User className="w-4 h-4" />
              Female
            </button>
          </div>
        </div>

        <div className="col-span-2">
          <Label>Date of Birth *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {ownerData.date_of_birth ? format(ownerData.date_of_birth, "PPP") : "Select birthdate"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={ownerData.date_of_birth}
                onSelect={(date) => date && setOwnerData({ ...ownerData, date_of_birth: date })}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="col-span-2">
          <Label>Nationality *</Label>
          <SearchableSelect
            value={ownerData.nationality}
            onValueChange={(v) => setOwnerData({ ...ownerData, nationality: v })}
            options={nationalityOptions}
            placeholder="Select nationality"
            searchPlaceholder="Search countries..."
            emptyMessage="No country found."
          />
        </div>

        <div className="col-span-2">
          <Label>Address (Optional)</Label>
          <Textarea
            value={ownerData.address}
            onChange={(e) => setOwnerData({ ...ownerData, address: e.target.value })}
            placeholder="Full address"
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label>Blood Type (Optional)</Label>
          <Input
            value={ownerData.blood_type}
            onChange={(e) => setOwnerData({ ...ownerData, blood_type: e.target.value })}
            placeholder="e.g., A+, O-, B+"
          />
        </div>
      </div>
    </div>
  );

  const renderLinkOwnerStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select an existing platform member to assign as owner:</p>
      <SearchableSelect
        value={existingUserId}
        onValueChange={setExistingUserId}
        options={allUsers.map(u => ({
          value: u.user_id,
          label: `${u.name} (${u.email})`,
        }))}
        placeholder="Select a member"
        searchPlaceholder="Search by name or email..."
        emptyMessage="No members found."
      />
    </div>
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => {
      setIsDialogOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New Club
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Club</DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
              currentStep === "club-info" 
                ? "bg-red-500 text-white ring-4 ring-red-100" 
                : "bg-green-500 text-white"
            )}>
              {currentStep === "club-info" ? "1" : "✓"}
            </div>
            <span className="text-sm font-medium">Club Info</span>
          </div>
          
          <div className={cn(
            "h-0.5 w-12 transition-all",
            currentStep === "club-info" ? "bg-gray-300" : "bg-green-500"
          )} />
          
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
              currentStep === "owner-choice"
                ? "bg-red-500 text-white ring-4 ring-red-100"
                : currentStep === "create-owner" || currentStep === "link-owner"
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-600"
            )}>
              {currentStep === "create-owner" || currentStep === "link-owner" ? "✓" : "2"}
            </div>
            <span className="text-sm font-medium">Owner Selection</span>
          </div>
          
          <div className={cn(
            "h-0.5 w-12 transition-all",
            currentStep === "create-owner" || currentStep === "link-owner" ? "bg-red-500" : "bg-gray-300"
          )} />
          
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
              currentStep === "create-owner" || currentStep === "link-owner"
                ? "bg-red-500 text-white ring-4 ring-red-100"
                : "bg-gray-300 text-gray-600"
            )}>
              3
            </div>
            <span className="text-sm font-medium">
              {currentStep === "create-owner" ? "Create Owner" : currentStep === "link-owner" ? "Link Owner" : "Owner Details"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === "club-info" && renderClubInfoStep()}
          {currentStep === "owner-choice" && renderOwnerChoiceStep()}
          {currentStep === "create-owner" && renderCreateOwnerStep()}
          {currentStep === "link-owner" && renderLinkOwnerStep()}
        </div>

        {imageToEdit && (
          <ImageCropper
            image={imageToEdit}
            aspectRatioType={aspectRatioType}
            onCropComplete={handleCropComplete}
            onClose={handleCloseCropper}
            maxOutputSize={maxOutputSize}
          />
        )}

        <div className="flex justify-between gap-2 pt-4 border-t">
          {currentStep !== "club-info" && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {currentStep !== "create-owner" && currentStep !== "link-owner" ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Club"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};