import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/form/DatePickerField";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ImageUploadCropper } from "@/components/ImageUploadCropper";
import { Plus, X, User, ChevronRight, ChevronLeft, Upload, MapPin, Clock, Check } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import countries from "world-countries";
import { cn } from "@/lib/utils";
import { detectCountryFromIP } from "@/lib/ipDetection";

interface Child {
  id: string;
  name: string;
  gender: "male" | "female";
  dateOfBirth: Date | null;
  nationality: string;
  avatarFile?: File | null;
  avatarUrl?: string;
}

interface PersonForPackage {
  id: string;
  name: string;
  gender: "male" | "female";
  dateOfBirth: Date | null;
  nationality: string;
  type: "guardian" | "child";
  isJoining: boolean;
  selectedPackageIds: string[];
  avatarFile?: File | null;
  avatarUrl?: string;
}

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_months: number;
  age_min?: number;
  age_max?: number;
  gender_restriction: string;
  package_activities: Array<{
    activities: {
      title: string;
      duration_minutes: number;
      activity_schedules: Array<{
        day_of_week: string;
        start_time: string;
        end_time: string;
      }>;
    };
  }>;
}

interface AdminWalkInRegistrationProps {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AdminWalkInRegistration: React.FC<AdminWalkInRegistrationProps> = ({
  clubId,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Page 1: Guardian Info
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianPhoneCode, setGuardianPhoneCode] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [guardianDateOfBirth, setGuardianDateOfBirth] = useState<Date | null>(null);
  const [guardianGender, setGuardianGender] = useState<"male" | "female" | null>(null);
  const [guardianNationality, setGuardianNationality] = useState("");
  const [guardianAvatarFile, setGuardianAvatarFile] = useState<File | null>(null);
  const [guardianAvatarUrl, setGuardianAvatarUrl] = useState("");
  const [showGuardianImageCropper, setShowGuardianImageCropper] = useState(false);

  // Page 2: Guardian Check & Children
  const [isGuardian, setIsGuardian] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [currentChildCropIndex, setCurrentChildCropIndex] = useState<number | null>(null);

  // Page 3: Package Selection
  const [people, setPeople] = useState<PersonForPackage[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [enrollmentFee, setEnrollmentFee] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [vatPercentage, setVatPercentage] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);

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

  const nationalityOptions = countryOptions.map((c) => ({
    value: c.name,
    label: c.name,
    icon: c.flag,
  }));

  useEffect(() => {
    if (open) {
      fetchClubData();
      detectCountryFromIP().then((detectedCode) => {
        if (detectedCode) {
          const detectedCountry = countryOptions.find((c) => c.code === detectedCode);
          if (detectedCountry && !guardianNationality) {
            setGuardianNationality(detectedCountry.name);
          }
        }
      });
    }
  }, [open, clubId]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (step === 3) {
      buildPeopleList();
    }
  }, [step]);

  const resetForm = () => {
    setStep(1);
    setGuardianName("");
    setGuardianEmail("");
    setGuardianPhone("");
    setGuardianPhoneCode("");
    setGuardianAddress("");
    setGuardianDateOfBirth(null);
    setGuardianGender(null);
    setGuardianNationality("");
    setGuardianAvatarFile(null);
    setGuardianAvatarUrl("");
    setIsGuardian(false);
    setChildren([]);
    setPeople([]);
    setDiscountValue(0);
  };

  const fetchClubData = async () => {
    const { data: club } = await supabase
      .from("clubs")
      .select("enrollment_fee, currency, vat_percentage")
      .eq("id", clubId)
      .single();

    if (club) {
      setEnrollmentFee(club.enrollment_fee || 0);
      setCurrency(club.currency || "USD");
      setVatPercentage(club.vat_percentage || 0);
    }

    const { data: pkgs } = await supabase
      .from("club_packages")
      .select(`
        *,
        package_activities(
          activities(
            title,
            duration_minutes,
            activity_schedules(
              day_of_week,
              start_time,
              end_time
            )
          )
        )
      `)
      .eq("club_id", clubId)
      .eq("booking_enabled", true);

    setPackages((pkgs as any) || []);
  };

  const buildPeopleList = () => {
    const peopleList: PersonForPackage[] = [];

    // Add guardian if they filled in DOB and gender
    if (guardianDateOfBirth && guardianGender) {
      peopleList.push({
        id: "guardian",
        name: guardianName,
        gender: guardianGender,
        dateOfBirth: guardianDateOfBirth,
        nationality: guardianNationality,
        type: "guardian",
        isJoining: false,
        selectedPackageIds: [],
        avatarFile: guardianAvatarFile,
        avatarUrl: guardianAvatarUrl,
      });
    }

    // Add all children
    children.forEach((child) => {
      if (child.dateOfBirth) {
        peopleList.push({
          id: child.id,
          name: child.name,
          gender: child.gender,
          dateOfBirth: child.dateOfBirth,
          nationality: child.nationality,
          type: "child",
          isJoining: false,
          selectedPackageIds: [],
          avatarFile: child.avatarFile,
          avatarUrl: child.avatarUrl,
        });
      }
    });

    setPeople(peopleList);
  };

  const addChild = () => {
    setChildren([
      ...children,
      {
        id: crypto.randomUUID(),
        name: "",
        gender: "male",
        dateOfBirth: null,
        nationality: guardianNationality,
        avatarFile: null,
        avatarUrl: "",
      },
    ]);
  };

  const removeChild = (id: string) => {
    setChildren(children.filter((c) => c.id !== id));
  };

  const updateChild = (id: string, updates: Partial<Child>) => {
    setChildren(children.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const updatePerson = (id: string, updates: Partial<PersonForPackage>) => {
    setPeople(people.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const togglePackageForPerson = (personId: string, packageId: string) => {
    setPeople(
      people.map((p) => {
        if (p.id === personId) {
          const selectedIds = p.selectedPackageIds.includes(packageId)
            ? p.selectedPackageIds.filter((id) => id !== packageId)
            : [...p.selectedPackageIds, packageId];
          return { ...p, selectedPackageIds: selectedIds };
        }
        return p;
      })
    );
  };

  const calculateAge = (dateOfBirth: Date) => {
    return differenceInYears(new Date(), dateOfBirth);
  };

  const getEligiblePackages = (person: PersonForPackage) => {
    if (!person.dateOfBirth) return [];

    const age = calculateAge(person.dateOfBirth);

    return packages.filter((pkg) => {
      if (pkg.age_min !== null && age < pkg.age_min) return false;
      if (pkg.age_max !== null && age > pkg.age_max) return false;

      if (pkg.gender_restriction === "male" && person.gender !== "male") return false;
      if (pkg.gender_restriction === "female" && person.gender !== "female") return false;

      return true;
    });
  };

  const calculateTotals = () => {
    const joiningPeople = people.filter((p) => p.isJoining);
    const memberCount = joiningPeople.length;

    // Check if each person is a previous member
    const enrollmentTotal = enrollmentFee * memberCount;

    const packagesTotal = joiningPeople.reduce((sum, person) => {
      const personPackages = person.selectedPackageIds
        .map((id) => packages.find((p) => p.id === id))
        .filter(Boolean);
      const personTotal = personPackages.reduce((s, pkg) => s + (pkg?.price || 0), 0);
      return sum + personTotal;
    }, 0);

    const subtotal = enrollmentTotal + packagesTotal;

    let discount = 0;
    if (discountValue > 0) {
      discount =
        discountType === "percentage"
          ? (subtotal * discountValue) / 100
          : discountValue;
    }

    const afterDiscount = subtotal - discount;
    const vat = afterDiscount * (vatPercentage / 100);
    const grandTotal = afterDiscount + vat;

    return { enrollmentTotal, packagesTotal, subtotal, discount, vat, grandTotal, memberCount };
  };

  const handleGuardianImageSelected = (file: File) => {
    setGuardianAvatarFile(file);
    setShowGuardianImageCropper(false);
    const url = URL.createObjectURL(file);
    setGuardianAvatarUrl(url);
  };

  const handleChildImageSelected = (file: File, index: number) => {
    updateChild(children[index].id, {
      avatarFile: file,
      avatarUrl: URL.createObjectURL(file),
    });
    setCurrentChildCropIndex(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const canProceedToStep2 = () => {
    return (
      guardianName &&
      guardianEmail &&
      guardianPhone &&
      guardianPhoneCode &&
      guardianDateOfBirth &&
      guardianGender &&
      guardianNationality
    );
  };

  const canProceedToStep3 = () => {
    if (!isGuardian) return true;
    return children.every(
      (c) => c.name && c.dateOfBirth && c.gender && c.nationality
    );
  };

  const canProceedToStep4 = () => {
    const joiningPeople = people.filter((p) => p.isJoining);
    if (joiningPeople.length === 0) return false;
    return joiningPeople.every((p) => p.selectedPackageIds.length > 0);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const joiningPeople = people.filter((p) => p.isJoining);

      // Upload all avatars first
      for (const person of joiningPeople) {
        if (person.avatarFile) {
          const fileExt = person.avatarFile.name.split(".").pop();
          const fileName = `${clubId}/${person.id}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, person.avatarFile);

          if (!uploadError) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
            person.avatarUrl = data.publicUrl;
          }
        }
      }

      // Create profiles
      const guardianUser = joiningPeople.find((p) => p.type === "guardian");
      let parentUserId: string | null = null;

      // Note: For walk-in registration, we don't create auth users
      // We'll just create club_members directly

      // Create children records if guardian exists
      const childRecords: { [key: string]: string } = {};
      if (isGuardian && parentUserId) {
        for (const person of joiningPeople.filter((p) => p.type === "child")) {
          const { data: childData } = await supabase
            .from("children")
            .insert({
              parent_user_id: parentUserId,
              name: person.name,
              gender: person.gender,
              date_of_birth: format(person.dateOfBirth!, "yyyy-MM-dd"),
              nationality: person.nationality,
              avatar_url: person.avatarUrl || null,
            })
            .select()
            .single();

          if (childData) {
            childRecords[person.id] = childData.id;
          }
        }
      }

      // Create club_members
      const memberInserts = joiningPeople.map((person) => ({
        club_id: clubId,
        name: person.name,
        rank: "Beginner",
        user_id: person.type === "guardian" && parentUserId ? parentUserId : null,
        child_id: person.type === "child" ? childRecords[person.id] : null,
        joined_date: format(new Date(), "yyyy-MM-dd"),
        is_active: true,
        avatar_url: person.avatarUrl || null,
      }));

      const { data: members, error: membersError } = await supabase
        .from("club_members")
        .insert(memberInserts)
        .select();

      if (membersError) throw membersError;

      // Enroll in packages
      const enrollments: any[] = [];
      members?.forEach((member, idx) => {
        const person = joiningPeople[idx];
        person.selectedPackageIds.forEach((packageId) => {
          enrollments.push({
            member_id: member.id,
            package_id: packageId,
            is_active: true,
          });
        });
      });

      await supabase.from("package_enrollments").insert(enrollments);

      // Send receipt email
      const totals = calculateTotals();
      const membersData = joiningPeople.map((person) => {
        const personPackages = person.selectedPackageIds
          .map((id) => packages.find((p) => p.id === id))
          .filter(Boolean);

        return {
          name: person.name,
          packages: personPackages.map((pkg) => ({
            name: pkg?.name || "",
            price: pkg?.price || 0,
            schedule: pkg?.package_activities
              .map((pa) =>
                pa.activities.activity_schedules.map(
                  (s) =>
                    `${s.day_of_week} ${s.start_time}-${s.end_time}`
                )
              )
              .flat()
              .join(", "),
          })),
        };
      });

      await supabase.functions.invoke("send-registration-receipt", {
        body: {
          clubId,
          parentName: guardianName,
          parentEmail: guardianEmail,
          parentPhone: `${guardianPhoneCode}${guardianPhone}`,
          parentAddress: guardianAddress || undefined,
          members: membersData,
          enrollmentFee,
          discount: totals.discount,
          discountType,
          vat: totals.vat,
          total: totals.grandTotal,
        },
      });

      toast({
        title: "Registration Complete!",
        description: "Members registered successfully. Receipt sent via email.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete registration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Render Page 1: Personal Information
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Guardian/Contact Information</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Full Name *</Label>
          <Input
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>
      </div>

      <div>
        <Label>Phone Number *</Label>
        <PhoneInput
          countryCode={guardianPhoneCode}
          phoneNumber={guardianPhone}
          onCountryCodeChange={setGuardianPhoneCode}
          onPhoneNumberChange={setGuardianPhone}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>
            Date of Birth *
          </Label>
          <DatePickerField
            value={guardianDateOfBirth || undefined}
            onSelect={(date) => setGuardianDateOfBirth(date || null)}
            placeholder="Select date"
            maxDate={new Date()}
            minDate={new Date("1900-01-01")}
          />
        </div>

        <div>
          <Label>Gender *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={guardianGender === "male" ? "default" : "outline"}
              onClick={() => setGuardianGender("male")}
            >
              <User className="mr-2 h-4 w-4" />
              Male
            </Button>
            <Button
              type="button"
              variant={guardianGender === "female" ? "default" : "outline"}
              onClick={() => setGuardianGender("female")}
            >
              <User className="mr-2 h-4 w-4" />
              Female
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label>Nationality *</Label>
        <SearchableSelect
          value={guardianNationality}
          onValueChange={setGuardianNationality}
          options={nationalityOptions}
          placeholder="Select nationality"
          searchPlaceholder="Search countries..."
          emptyMessage="No country found."
        />
      </div>

      <div>
        <Label>Address (Optional)</Label>
        <Textarea
          value={guardianAddress}
          onChange={(e) => setGuardianAddress(e.target.value)}
          placeholder="Full address"
          rows={2}
        />
      </div>

      <div>
        <Label>Profile Picture (Optional)</Label>
        <div className="mt-2">
          <ImageUploadCropper
            onImageSelected={handleGuardianImageSelected}
            currentImageUrl={guardianAvatarUrl}
            showImage={true}
          />
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={() => setStep(2)} disabled={!canProceedToStep2()}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Render Page 2: Guardian Check & Children
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Are you a guardian?</h3>
        <div className="flex gap-4">
          <Button
            variant={isGuardian ? "default" : "outline"}
            onClick={() => setIsGuardian(true)}
            className="flex-1"
          >
            <Check className={cn("mr-2 h-4 w-4", !isGuardian && "opacity-0")} />
            Yes
          </Button>
          <Button
            variant={!isGuardian ? "default" : "outline"}
            onClick={() => {
              setIsGuardian(false);
              setChildren([]);
            }}
            className="flex-1"
          >
            <Check className={cn("mr-2 h-4 w-4", isGuardian && "opacity-0")} />
            No
          </Button>
        </div>
      </div>

      {isGuardian && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Children</h4>
            <Button size="sm" onClick={addChild}>
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          </div>

          {children.map((child, index) => (
            <Card key={child.id} className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h5 className="font-medium">Child {index + 1}</h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChild(child.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={child.name}
                      onChange={(e) =>
                        updateChild(child.id, { name: e.target.value })
                      }
                      placeholder="Child's name"
                    />
                  </div>

                  <div>
                    <Label>Date of Birth *</Label>
                    <DatePickerField
                      value={child.dateOfBirth || undefined}
                      onSelect={(date) =>
                        updateChild(child.id, { dateOfBirth: date || null })
                      }
                      placeholder="Select date"
                      maxDate={new Date()}
                      minDate={new Date("1900-01-01")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Gender *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={child.gender === "male" ? "default" : "outline"}
                        onClick={() => updateChild(child.id, { gender: "male" })}
                      >
                        Male
                      </Button>
                      <Button
                        type="button"
                        variant={child.gender === "female" ? "default" : "outline"}
                        onClick={() => updateChild(child.id, { gender: "female" })}
                      >
                        Female
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Nationality *</Label>
                    <SearchableSelect
                      value={child.nationality}
                      onValueChange={(value) =>
                        updateChild(child.id, { nationality: value })
                      }
                      options={nationalityOptions}
                      placeholder="Select"
                      searchPlaceholder="Search..."
                      emptyMessage="Not found."
                    />
                  </div>
                </div>

                <div>
                  <Label>Profile Picture (Optional)</Label>
                  <div className="mt-2">
                    <ImageUploadCropper
                      onImageSelected={(file) => handleChildImageSelected(file, index)}
                      currentImageUrl={child.avatarUrl}
                      showImage={true}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => setStep(3)} disabled={!canProceedToStep3()}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Render Page 3: Membership Selection & Cost Calculation
  const renderStep3 = () => {
    const totals = calculateTotals();

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Select Packages for Each Person
          </h3>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {people.map((person) => {
            const eligiblePackages = getEligiblePackages(person);
            const age = person.dateOfBirth ? calculateAge(person.dateOfBirth) : 0;

            return (
              <Card key={person.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={person.isJoining}
                        onCheckedChange={(checked) =>
                          updatePerson(person.id, { isJoining: checked as boolean })
                        }
                      />
                      <div>
                        <h4 className="font-semibold">{person.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {person.type === "guardian" ? "Guardian" : "Child"} • Age {age} •{" "}
                          {person.gender}
                        </p>
                      </div>
                    </div>
                    {person.avatarUrl && (
                      <img
                        src={person.avatarUrl}
                        alt={person.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                  </div>

                  {person.isJoining && (
                    <div className="pl-8 space-y-3">
                      <Label className="text-sm font-medium">
                        Select Packages (can select multiple)
                      </Label>

                      {eligiblePackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No packages available for this age/gender
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {eligiblePackages.map((pkg) => {
                            const isSelected = person.selectedPackageIds.includes(
                              pkg.id
                            );
                            return (
                              <div
                                key={pkg.id}
                                className={cn(
                                  "border rounded-lg p-3 cursor-pointer transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                )}
                                onClick={() => togglePackageForPerson(person.id, pkg.id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3 flex-1">
                                    <Checkbox checked={isSelected} />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <h5 className="font-medium">{pkg.name}</h5>
                                        <Badge variant="secondary">
                                          {formatCurrency(pkg.price)}
                                        </Badge>
                                      </div>
                                      {pkg.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {pkg.description}
                                        </p>
                                      )}
                                      {pkg.age_min !== null || pkg.age_max !== null ? (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Age: {pkg.age_min || "0"} - {pkg.age_max || "∞"}
                                        </p>
                                      ) : null}

                                      {pkg.package_activities && pkg.package_activities.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground">
                                            <Clock className="inline h-3 w-3 mr-1" />
                                            Schedule:
                                          </p>
                                          {pkg.package_activities.map((pa, idx) => (
                                            <div key={idx} className="text-xs text-muted-foreground pl-4">
                                              <strong>{pa.activities.title}</strong>
                                              {pa.activities.activity_schedules.map((sched, sidx) => (
                                                <div key={sidx} className="ml-2">
                                                  • {sched.day_of_week}: {sched.start_time} - {sched.end_time}
                                                </div>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-4 bg-muted/50">
          <h4 className="font-semibold mb-3">Cost Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Enrollment Fee ({totals.memberCount} members)</span>
              <span>{formatCurrency(totals.enrollmentTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Packages Total</span>
              <span>{formatCurrency(totals.packagesTotal)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>

            <div className="pt-2 space-y-2">
              <Label className="text-xs">Discount (Optional)</Label>
              <div className="flex gap-2">
                <Button
                  variant={discountType === "percentage" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDiscountType("percentage")}
                >
                  %
                </Button>
                <Button
                  variant={discountType === "fixed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDiscountType("fixed")}
                >
                  {currency}
                </Button>
                <Input
                  type="number"
                  value={discountValue || ""}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder="0"
                  className="flex-1"
                />
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
              )}
            </div>

            {vatPercentage > 0 && (
              <div className="flex justify-between">
                <span>VAT ({vatPercentage}%)</span>
                <span>{formatCurrency(totals.vat)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-3 border-t">
              <span>Total Amount</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => setStep(4)} disabled={!canProceedToStep4()}>
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Render Page 4: Payment Confirmation
  const renderStep4 = () => {
    const totals = calculateTotals();
    const joiningPeople = people.filter((p) => p.isJoining);

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Payment Confirmation</h3>
          <p className="text-muted-foreground">
            Please collect the payment and confirm to complete registration.
          </p>
        </div>

        <Card className="p-4 bg-primary/5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Total Amount to Collect</p>
            <p className="text-4xl font-bold">{formatCurrency(totals.grandTotal)}</p>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">Registration Summary</h4>
          <div className="space-y-4">
            {joiningPeople.map((person) => {
              const personPackages = person.selectedPackageIds
                .map((id) => packages.find((p) => p.id === id))
                .filter(Boolean);
              const personTotal =
                enrollmentFee +
                personPackages.reduce((s, pkg) => s + (pkg?.price || 0), 0);

              return (
                <div key={person.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-start gap-3 mb-2">
                    {person.avatarUrl && (
                      <img
                        src={person.avatarUrl}
                        alt={person.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {person.type === "guardian" ? "Guardian" : "Child"}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(personTotal)}</p>
                  </div>
                  <div className="pl-13 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Enrollment Fee</span>
                      <span>{formatCurrency(enrollmentFee)}</span>
                    </div>
                    {personPackages.map((pkg) => (
                      <div key={pkg?.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{pkg?.name}</span>
                        <span>{formatCurrency(pkg?.price || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setStep(3)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm Payment & Register"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Walk-In Registration</DialogTitle>
          <DialogDescription>
            Step {step} of 4: {
              step === 1 ? "Personal Information" :
              step === 2 ? "Guardian & Children" :
              step === 3 ? "Package Selection" :
              "Payment Confirmation"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4].map((stepNumber) => (
            <React.Fragment key={stepNumber}>
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors",
                  stepNumber === step
                    ? "bg-primary text-primary-foreground"
                    : stepNumber < step
                    ? "bg-primary/70 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {stepNumber < step ? (
                  <Check className="h-5 w-5" />
                ) : (
                  stepNumber
                )}
              </div>
              {stepNumber < 4 && (
                <div
                  className={cn(
                    "h-0.5 w-12 transition-colors",
                    stepNumber < step ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </DialogContent>
    </Dialog>
  );
};
