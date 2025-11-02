import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus, Upload, X, Mail, Phone, Search, User, Camera, Briefcase, Award, FileText, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { ImageCropper } from "@/components/ImageCropper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import countries from "world-countries";

interface AdminInstructorsProps {
  clubId: string;
  onUpdate?: () => void;
}

export const AdminInstructors: React.FC<AdminInstructorsProps> = ({ clubId, onUpdate }) => {
  const { toast } = useToast();
  const [instructors, setInstructors] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newTag, setNewTag] = useState("");
  const [creationType, setCreationType] = useState<"new" | "existing">("new");
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = creationType === "new" ? 6 : 5;
  const [instructorSearchQuery, setInstructorSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instructorToDelete, setInstructorToDelete] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  
  // Member creation fields
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberCountryCode, setNewMemberCountryCode] = useState("+1");
  const [newMemberGender, setNewMemberGender] = useState("male");
  const [newMemberDOB, setNewMemberDOB] = useState("");
  const [newMemberNationality, setNewMemberNationality] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    specialty: "",
    experience: "",
    bio: "",
    achievements: "",
    certifications: "",
    image_url: "",
    specialty_tags: [] as string[],
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToEdit, setImageToEdit] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const countryOptions = countries
    .filter((country) => country.cca2 !== "IL")
    .map((country) => ({
      label: country.name.common,
      value: country.cca2,
      icon: country.flag,
      callingCode: country.idd.root + (country.idd.suffixes?.[0] || ""),
    }));

  useEffect(() => {
    fetchInstructors();
  }, [clubId]);

  const fetchInstructors = async () => {
    const { data } = await supabase
      .from("club_instructors")
      .select(`
        *,
        club_members!member_id (
          id,
          user_id,
          child_id,
          avatar_url,
          name,
          is_active
        )
      `)
      .eq("club_id", clubId)
      .order("name");
    
    // Enrich instructors with profile data if they have a linked member
    const enrichedData = await Promise.all(
      (data || []).map(async (instructor) => {
        if (instructor.club_members?.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url, name, email, phone, gender, country_code, date_of_birth, nationality, address, blood_type, created_at")
            .eq("user_id", instructor.club_members.user_id)
            .maybeSingle();
          return { ...instructor, memberProfile: profile };
        }
        return instructor;
      })
    );

    // Deduplicate potential duplicates (e.g., owner also added as separate instructor)
    const normalizeName = (n: string) =>
      (n || "")
        .toLowerCase()
        .replace(/^(master|mr|mrs|ms|coach|dr)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const score = (i: any) => {
      let s = 0;
      if (i.club_members?.user_id) s += 5;
      if (i.memberProfile) s += 3;
      if (i.image_url) s += 2;
      if (Array.isArray(i.specialty_tags)) s += Math.min(2, i.specialty_tags.length);
      if (i.bio) s += 1;
      return s;
    };

    const byKey: Record<string, any> = {};
    for (const instr of enrichedData) {
      const n = normalizeName(instr.name);
      const parts = n.split(" ").filter(Boolean);
      const base = parts.length >= 2 ? `${parts[0]}-${parts[parts.length - 1]}` : n;
      const key = `${instr.club_id}:${base}`;
      if (!byKey[key] || score(instr) > score(byKey[key])) {
        byKey[key] = instr;
      }
    }

    const deduped = Object.values(byKey);
    setInstructors(deduped || []);
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getHoroscope = (dateOfBirth: string) => {
    const date = new Date(dateOfBirth);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const signs = [
      { sign: 'Capricorn', emoji: '♑', start: [12, 22], end: [1, 19] },
      { sign: 'Aquarius', emoji: '♒', start: [1, 20], end: [2, 18] },
      { sign: 'Pisces', emoji: '♓', start: [2, 19], end: [3, 20] },
      { sign: 'Aries', emoji: '♈', start: [3, 21], end: [4, 19] },
      { sign: 'Taurus', emoji: '♉', start: [4, 20], end: [5, 20] },
      { sign: 'Gemini', emoji: '♊', start: [5, 21], end: [6, 20] },
      { sign: 'Cancer', emoji: '♋', start: [6, 21], end: [7, 22] },
      { sign: 'Leo', emoji: '♌', start: [7, 23], end: [8, 22] },
      { sign: 'Virgo', emoji: '♍', start: [8, 23], end: [9, 22] },
      { sign: 'Libra', emoji: '♎', start: [9, 23], end: [10, 22] },
      { sign: 'Scorpio', emoji: '♏', start: [10, 23], end: [11, 21] },
      { sign: 'Sagittarius', emoji: '♐', start: [11, 22], end: [12, 21] },
    ];
    
    for (const { sign, emoji, start, end } of signs) {
      if ((month === start[0] && day >= start[1]) || (month === end[0] && day <= end[1])) {
        return { sign, emoji };
      }
    }
    
    return { sign: 'Capricorn', emoji: '♑' };
  };

  const getNextBirthdayCountdown = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const currentYear = today.getFullYear();
    
    let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
    
    if (nextBirthday < today) {
      nextBirthday = new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate());
    }
    
    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today! 🎉";
    if (diffDays === 1) return "Tomorrow! 🎂";
    
    return `${diffDays} days`;
  };

  const getCountryFlag = (countryCode: string) => {
    if (!countryCode) return "";
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const resetForm = () => {
    setFormData({ 
      name: "", 
      specialty: "", 
      experience: "", 
      bio: "", 
      achievements: "",
      certifications: "",
      image_url: "", 
      specialty_tags: [],
    });
    setEditingItem(null);
    setNewTag("");
    setCreationType("new");
    setMemberSearch("");
    setSearchResults([]);
    setSelectedUserId(null);
    setImageToEdit("");
    setNewMemberEmail("");
    setNewMemberPassword("");
    setNewMemberPhone("");
    setNewMemberCountryCode("+1");
    setNewMemberGender("male");
    setNewMemberDOB("");
    setNewMemberNationality("");
    setCurrentStep(1);
  };

  const searchMembers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Get profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, email, phone, avatar_url")
        .or(`email.ilike.%${query}%,phone.ilike.%${query}%`);

      if (profilesError) throw profilesError;

      // Get club members for this club
      const { data: membersData, error: membersError } = await supabase
        .from("club_members")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true);

      if (membersError) throw membersError;

      // Combine and deduplicate results
      const combined = [
        ...(profilesData || []).map(p => ({
          id: p.user_id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          avatar_url: p.avatar_url,
          type: 'profile'
        })),
        ...(membersData || []).map(m => ({
          id: m.id,
          user_id: m.user_id,
          name: m.name,
          email: null,
          phone: null,
          avatar_url: m.avatar_url,
          type: 'member'
        }))
      ];

      setSearchResults(combined);
    } catch (error) {
      console.error("Search error:", error);
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const selectMember = async (member: any) => {
    // Auto-populate name and image from selected member
    let memberName = member.name;
    let memberImage = member.avatar_url;
    
    // If it's a profile type, fetch full profile data
    if (member.type === 'profile') {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("user_id", member.id)
        .maybeSingle();
      
      if (profile) {
        memberName = profile.name;
        memberImage = profile.avatar_url;
      }
    }
    
    setFormData({
      ...formData,
      name: memberName || "",
      image_url: memberImage || "",
    });
    setSelectedUserId(member.type === 'profile' ? member.id : null);
    setMemberSearch("");
    setSearchResults([]);
    toast({ title: "Member selected. Name will be taken from their profile." });
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      specialty: item.specialty,
      experience: item.experience,
      bio: item.bio || "",
      achievements: item.achievements || "",
      certifications: item.certifications || "",
      image_url: item.image_url || "",
      specialty_tags: item.specialty_tags || [],
    });
    setIsDialogOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToEdit(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const fileExt = "jpg";
      const fileName = `${user.id}/instructor-${clubId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData({ ...formData, image_url: publicUrl });
      setImageToEdit("");
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const validateStep = (step: number): boolean => {
    // Step 1: Selection is always valid
    if (step === 1) return true;
    
    if (creationType === "new") {
      // For new: Step 2 = member info, Step 3 = name/photo, Step 4 = role/exp, Step 5 = skills, Step 6 = bio
      switch (step) {
        case 2:
          if (!newMemberEmail || !newMemberPassword || !newMemberPhone || !newMemberDOB || !newMemberNationality) {
            toast({ title: "Please fill in all member details", variant: "destructive" });
            return false;
          }
          return true;
        case 3:
          if (!formData.name) {
            toast({ title: "Please enter instructor name", variant: "destructive" });
            return false;
          }
          return true;
        case 4:
          if (!formData.specialty) {
            toast({ title: "Please enter the role", variant: "destructive" });
            return false;
          }
          if (!formData.experience) {
            toast({ title: "Please enter years of experience", variant: "destructive" });
            return false;
          }
          return true;
        case 5:
          if (formData.specialty_tags.length === 0) {
            toast({ title: "Please add at least one skill", variant: "destructive" });
            return false;
          }
          return true;
        default:
          return true;
      }
    } else {
      // For existing: Step 2 = search/select, Step 3 = role/exp, Step 4 = skills, Step 5 = bio
      switch (step) {
        case 2:
          if (!selectedUserId) {
            toast({ title: "Please select a member", variant: "destructive" });
            return false;
          }
          return true;
        case 3:
          if (!formData.specialty) {
            toast({ title: "Please enter the role", variant: "destructive" });
            return false;
          }
          if (!formData.experience) {
            toast({ title: "Please enter years of experience", variant: "destructive" });
            return false;
          }
          return true;
        case 4:
          if (formData.specialty_tags.length === 0) {
            toast({ title: "Please add at least one skill", variant: "destructive" });
            return false;
          }
          return true;
        default:
          return true;
      }
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.specialty || !formData.experience) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }

    if (editingItem) {
      // Update existing instructor
      try {
        const payload = {
          name: formData.name,
          specialty: formData.specialty,
          experience: formData.experience,
          bio: formData.bio || null,
          achievements: formData.achievements || null,
          certifications: formData.certifications || null,
          image_url: formData.image_url || null,
          specialty_tags: formData.specialty_tags,
        };

        // If instructor is linked to a user profile, sync the profile data
        if (editingItem.club_members?.user_id) {
          const { error: profileError } = await supabase.functions.invoke("update-member-profile", {
            body: {
              userId: editingItem.club_members.user_id,
              profile: {
                name: formData.name,
                avatar_url: formData.image_url || null,
              },
            },
          });

          if (profileError) {
            console.error("Profile update error:", profileError);
            toast({ 
              title: "Warning: Profile sync failed", 
              description: "Instructor updated but linked profile could not be synced",
              variant: "destructive" 
            });
          }
        }

        // Update instructor record
        const { error } = await supabase.from("club_instructors").update(payload).eq("id", editingItem.id);
        if (error) {
          toast({ title: "Error updating instructor", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Instructor updated successfully" });
          fetchInstructors();
          setIsDialogOpen(false);
          resetForm();
          onUpdate?.();
        }
      } catch (error: any) {
        toast({ 
          title: "Error updating instructor", 
          description: error.message,
          variant: "destructive" 
        });
      }
    } else {
      // Create new instructor
      if (creationType === 'new') {
        // First create the member account
        if (!newMemberEmail || !newMemberPassword || !newMemberPhone || !newMemberDOB || !newMemberNationality) {
          toast({ 
            title: "Member information required", 
            description: "Please fill in all member details",
            variant: "destructive" 
          });
          return;
        }

        try {
          // Create member via edge function
          const { data: memberData, error: memberError } = await supabase.functions.invoke("create-member", {
            body: {
              email: newMemberEmail,
              password: newMemberPassword,
              name: formData.name,
              phone: newMemberPhone,
              country_code: newMemberCountryCode,
              date_of_birth: newMemberDOB,
              nationality: newMemberNationality,
              gender: newMemberGender,
              avatar_url: formData.image_url || null,
            },
          });

          if (memberError) throw memberError;
          if (memberData?.error) throw new Error(memberData.error);

          // Now create instructor linked to this member
          const { error: instructorError } = await supabase.functions.invoke("create-instructor", {
            body: {
              clubId,
              userId: memberData.user_id,
              instructorData: {
                name: formData.name,
                specialty: formData.specialty,
                experience: formData.experience,
                bio: formData.bio || null,
                achievements: formData.achievements || null,
                certifications: formData.certifications || null,
                image_url: formData.image_url || null,
                specialty_tags: formData.specialty_tags,
              },
            },
          });

          if (instructorError) throw instructorError;

          toast({ title: "Instructor and member account created successfully" });
          fetchInstructors();
          setIsDialogOpen(false);
          resetForm();
          onUpdate?.();
        } catch (error: any) {
          toast({ 
            title: "Error creating instructor", 
            description: error.message,
            variant: "destructive" 
          });
        }
      } else {
        // Link existing member as instructor
        if (!selectedUserId) {
          toast({ 
            title: "Member selection required", 
            description: "Please select an existing member",
            variant: "destructive" 
          });
          return;
        }

        const { error } = await supabase.functions.invoke("create-instructor", {
          body: {
            clubId,
            userId: selectedUserId,
            instructorData: {
              name: formData.name,
              specialty: formData.specialty,
              experience: formData.experience,
              bio: formData.bio || null,
              achievements: formData.achievements || null,
              certifications: formData.certifications || null,
              image_url: formData.image_url || null,
              specialty_tags: formData.specialty_tags,
            },
          },
        });

        if (error) {
          toast({ title: "Error creating instructor", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Instructor created from existing member" });
          fetchInstructors();
          setIsDialogOpen(false);
          resetForm();
          onUpdate?.();
        }
      }
    }
  };

  const addTag = () => {
    if (newTag && !formData.specialty_tags.includes(newTag)) {
      setFormData({ ...formData, specialty_tags: [...formData.specialty_tags, newTag] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, specialty_tags: formData.specialty_tags.filter(t => t !== tag) });
  };

  const openDeleteDialog = (instructor: any) => {
    setInstructorToDelete(instructor);
    setDeleteDialogOpen(true);
    setDeleteConfirmText("");
    setDeleteReason("");
  };

  const handleDeleteConfirm = async () => {
    if (!instructorToDelete) return;
    
    const { error } = await supabase.functions.invoke("remove-instructor", {
      body: {
        instructorId: instructorToDelete.id,
        leaveReason: deleteReason || undefined,
      },
    });

    if (error) {
      toast({ title: "Error removing instructor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Instructor removed successfully", description: "Employment history has been recorded" });
      fetchInstructors();
      onUpdate?.();
      setDeleteDialogOpen(false);
      setInstructorToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Instructors</h2>
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => { 
            setIsDialogOpen(open); 
            if (!open) {
              // Small delay to prevent form reset before dialog closes
              setTimeout(() => resetForm(), 100);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Instructor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Instructor" : "Let's Add a New Instructor"}</DialogTitle>
              {!editingItem && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        currentStep > step 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : currentStep === step 
                          ? 'border-primary text-primary font-bold' 
                          : 'border-muted text-muted-foreground'
                      }`}>
                        {currentStep > step ? <Check className="h-5 w-5" /> : step}
                      </div>
                      {step < totalSteps && (
                        <div className={`flex-1 h-0.5 mx-2 ${
                          currentStep > step ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DialogHeader>

            {!editingItem ? (
              <div className="space-y-6 mt-6">
                {/* Step 1: How to add instructor */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">How would you like to add the instructor?</h3>
                        <p className="text-sm text-muted-foreground">Choose to create a new member or select an existing one</p>
                      </div>
                    </div>

                    <RadioGroup value={creationType} onValueChange={(val: any) => setCreationType(val)}>
                      <div className="flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setCreationType("new")}>
                        <RadioGroupItem value="new" id="new" />
                        <Label htmlFor="new" className="flex-1 cursor-pointer">
                          <div className="font-semibold">Create new instructor</div>
                          <div className="text-sm text-muted-foreground">Create a new TakeOne platform member and link as instructor</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setCreationType("existing")}>
                        <RadioGroupItem value="existing" id="existing" />
                        <Label htmlFor="existing" className="flex-1 cursor-pointer">
                          <div className="font-semibold">Select from existing members</div>
                          <div className="text-sm text-muted-foreground">Search and link an existing platform member as instructor</div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Step 2 for NEW: Create Platform Member */}
                {currentStep === 2 && creationType === "new" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">Create TakeOne Platform Member</h3>
                        <p className="text-sm text-muted-foreground">First, let's create their member account</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            placeholder="member@example.com"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Password *</Label>
                          <Input
                            type="password"
                            placeholder="Minimum 6 characters"
                            value={newMemberPassword}
                            onChange={(e) => setNewMemberPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone Number *</Label>
                        <PhoneInput
                          phoneNumber={newMemberPhone}
                          countryCode={newMemberCountryCode}
                          onPhoneNumberChange={setNewMemberPhone}
                          onCountryCodeChange={setNewMemberCountryCode}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Gender *</Label>
                          <Select value={newMemberGender} onValueChange={setNewMemberGender}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Date of Birth *</Label>
                          <Input
                            type="date"
                            value={newMemberDOB}
                            onChange={(e) => setNewMemberDOB(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Nationality *</Label>
                        <SearchableSelect
                          value={newMemberNationality}
                          onValueChange={setNewMemberNationality}
                          options={countryOptions}
                          placeholder="Select country..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 for EXISTING: Search and Select Member */}
                {currentStep === 2 && creationType === "existing" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Search className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">Find Platform Member</h3>
                        <p className="text-sm text-muted-foreground">Search by email or phone number</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by email or phone number..."
                          value={memberSearch}
                          onChange={(e) => {
                            setMemberSearch(e.target.value);
                            searchMembers(e.target.value);
                          }}
                          className="pl-9 h-12"
                        />
                      </div>
                      
                      {isSearching && (
                        <p className="text-sm text-muted-foreground">Searching...</p>
                      )}
                      
                      {searchResults.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                          {searchResults.map((member) => (
                            <div
                              key={member.id}
                              className={`p-4 hover:bg-accent cursor-pointer transition-colors flex items-center gap-3 ${
                                selectedUserId === member.id ? 'bg-accent border-2 border-primary' : ''
                              }`}
                              onClick={() => selectMember(member)}
                            >
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-6 w-6 text-primary" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{member.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {member.email || member.phone || "Member"}
                                </p>
                              </div>
                              {selectedUserId === member.id && (
                                <Check className="h-5 w-5 text-primary" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {memberSearch && !isSearching && searchResults.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No members found</p>
                        </div>
                      )}

                      {selectedUserId && formData.name && (
                        <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
                          <p className="text-sm font-semibold mb-1">Selected Member</p>
                          <p className="text-lg font-bold">{formData.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3 for NEW: Name & Photo */}
                {currentStep === 3 && creationType === "new" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">First, let's get to know you</h3>
                        <p className="text-sm text-muted-foreground">Tell us your name and share a photo</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">What's your full name? *</Label>
                        <Input 
                          value={formData.name} 
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                          placeholder="Enter your full name"
                          className="mt-2 h-12 text-base"
                        />
                      </div>

                      <div>
                        <Label className="text-base">Share your photo</Label>
                        <p className="text-sm text-muted-foreground mb-3">This helps members recognize you</p>
                        
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        
                        <div className="flex items-center gap-4">
                          {formData.image_url ? (
                            <div className="relative">
                              <img 
                                src={formData.image_url} 
                                alt="Preview" 
                                className="h-32 w-32 object-cover rounded-full border-4 border-primary/20" 
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="absolute bottom-0 right-0 rounded-full"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-full cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-xs text-muted-foreground">Upload</span>
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className="w-full"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {isUploading ? "Uploading..." : formData.image_url ? "Change Photo" : "Upload Photo"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 for EXISTING / Step 4 for NEW: Role & Experience */}
                {((currentStep === 3 && creationType === "existing") || (currentStep === 4 && creationType === "new")) && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Briefcase className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">What do you do?</h3>
                        <p className="text-sm text-muted-foreground">Tell us about your professional background</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">What's your role? *</Label>
                        <Input 
                          value={formData.specialty} 
                          onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} 
                          placeholder="e.g., Martial Arts Instructor"
                          className="mt-2 h-12 text-base"
                        />
                      </div>

                      <div>
                        <Label className="text-base">How many years of experience do you have? *</Label>
                        <Input 
                          value={formData.experience} 
                          onChange={(e) => setFormData({ ...formData, experience: e.target.value })} 
                          placeholder="e.g., 5 years"
                          className="mt-2 h-12 text-base"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4 for EXISTING / Step 5 for NEW: Skills */}
                {((currentStep === 4 && creationType === "existing") || (currentStep === 5 && creationType === "new")) && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">What are you good at?</h3>
                        <p className="text-sm text-muted-foreground">Share your skills and specialties</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">Your Skills & Specialties *</Label>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">Add skills like Taekwondo, Muay Thai, Judo, etc.</p>
                        
                        {formData.specialty_tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4 p-4 bg-muted/30 rounded-lg">
                            {formData.specialty_tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="gap-1.5 text-sm py-1.5 px-3">
                                {tag}
                                <X 
                                  className="h-3.5 w-3.5 cursor-pointer hover:text-destructive" 
                                  onClick={() => removeTag(tag)}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder="Type a skill and press Enter"
                            className="h-12 text-base"
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          />
                          <Button type="button" onClick={addTag} size="lg" className="px-6">
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5 for EXISTING / Step 6 for NEW: Bio & Achievements */}
                {((currentStep === 5 && creationType === "existing") || (currentStep === 6 && creationType === "new")) && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">Tell us more about yourself</h3>
                        <p className="text-sm text-muted-foreground">Share your story, achievements, and qualifications</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">Your Story</Label>
                        <p className="text-sm text-muted-foreground mb-2">A brief introduction about yourself</p>
                        <Textarea 
                          value={formData.bio} 
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                          rows={4}
                          placeholder="Tell members about your background, passion, and teaching philosophy..."
                          className="resize-none"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-base">Your Achievements</Label>
                        <p className="text-sm text-muted-foreground mb-2">Notable accomplishments and awards</p>
                        <Textarea 
                          value={formData.achievements} 
                          onChange={(e) => setFormData({ ...formData, achievements: e.target.value })} 
                          rows={4}
                          placeholder="e.g., National Champion 2023, 10+ years competition experience..."
                          className="resize-none"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-base">Your Certifications</Label>
                        <p className="text-sm text-muted-foreground mb-2">Professional qualifications and training</p>
                        <Textarea 
                          value={formData.certifications} 
                          onChange={(e) => setFormData({ ...formData, certifications: e.target.value })} 
                          rows={4}
                          placeholder="e.g., Black Belt 3rd Dan, Certified Personal Trainer..."
                          className="resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between gap-3 pt-6 border-t mt-8">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setIsDialogOpen(false); resetForm(); }}
                  >
                    Cancel
                  </Button>
                  
                  <div className="flex gap-2">
                    {currentStep > 1 && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={handlePrevious}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                    )}
                    
                    {currentStep < totalSteps ? (
                      <Button 
                        type="button"
                        onClick={handleNext}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        onClick={handleSubmit}
                        className="bg-primary"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Create Instructor
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Edit mode - show all fields at once
              <div className="space-y-6 mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name *</Label>
                      <Input 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        placeholder="Instructor full name"
                      />
                    </div>
                    <div>
                      <Label>Role *</Label>
                      <Input 
                        value={formData.specialty} 
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} 
                        placeholder="e.g., Martial Arts Instructor"
                      />
                    </div>
                    <div>
                      <Label>Experience *</Label>
                      <Input 
                        value={formData.experience} 
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })} 
                        placeholder="e.g., 5 years"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-2">Profile Picture</h3>
                  <div className="flex items-start gap-4">
                    {formData.image_url && (
                      <img src={formData.image_url} alt="Preview" className="h-24 w-24 object-cover rounded-full border-2 border-border" />
                    )}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full md:w-auto"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? "Uploading..." : formData.image_url ? "Change Image" : "Upload Image"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-2">Speciality Or Skill Set</h3>
                  <p className="text-sm text-muted-foreground">Add skills like Taekwondo, Muay Thai, Judo, etc.</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.specialty_tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="gap-1 text-sm py-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-destructive" 
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Enter skill (e.g., Taekwondo)..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-2">Additional Details</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Bio</Label>
                      <Textarea 
                        value={formData.bio} 
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                        rows={3}
                        placeholder="Brief introduction about the instructor..."
                      />
                    </div>
                    
                    <div>
                      <Label>Achievements</Label>
                      <Textarea 
                        value={formData.achievements} 
                        onChange={(e) => setFormData({ ...formData, achievements: e.target.value })} 
                        rows={3}
                        placeholder="Notable achievements and awards..."
                      />
                    </div>
                    
                    <div>
                      <Label>Certifications</Label>
                      <Textarea 
                        value={formData.certifications} 
                        onChange={(e) => setFormData({ ...formData, certifications: e.target.value })} 
                        rows={3}
                        placeholder="Professional certifications and qualifications..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSubmit}>
                    Update
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          onClose={() => setImageToEdit("")}
          onCropComplete={handleCropComplete}
          aspectRatioType="circle"
          maxOutputSize={512}
        />
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search instructors by name, phone, email, or skills..."
          value={instructorSearchQuery}
          onChange={(e) => setInstructorSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove Instructor
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="font-semibold text-foreground mb-2">
                    You are about to remove:
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {instructorToDelete?.name || instructorToDelete?.club_members?.name || instructorToDelete?.memberProfile?.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {instructorToDelete?.specialty}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    This action will:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Remove the instructor from the active list</li>
                    <li>Create an employment history record</li>
                    <li>Record the end date of their position</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="delete-reason" className="text-foreground">
                      Reason for leaving (optional)
                    </Label>
                    <Textarea
                      id="delete-reason"
                      placeholder="e.g., Contract ended, Resigned, Position no longer needed..."
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="delete-confirm" className="text-foreground">
                      Type <span className="font-bold text-destructive">DELETE</span> to confirm
                    </Label>
                    <Input
                      id="delete-confirm"
                      placeholder="Type DELETE to confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setInstructorToDelete(null);
              setDeleteConfirmText("");
              setDeleteReason("");
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmText !== "DELETE"}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove Instructor
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {instructors
            .filter((it) => it?.name || it?.club_members?.name || it?.memberProfile?.name)
            .filter((item) => {
              if (!instructorSearchQuery.trim()) return true;
              
              const query = instructorSearchQuery.toLowerCase();
              const memberInfo = item.memberProfile;
              
              // Search in name
              const name = (item.name || item.club_members?.name || memberInfo?.name || "").toLowerCase();
              // Search in phone
              const phone = memberInfo?.phone?.toLowerCase() || "";
              // Search in email
              const email = memberInfo?.email?.toLowerCase() || "";
              // Search in specialty tags (skills)
              const skills = (item.specialty_tags || []).join(" ").toLowerCase();
              
              return name.includes(query) || phone.includes(query) || email.includes(query) || skills.includes(query);
            })
            .map((item) => {
            // Use member profile avatar if available, otherwise use instructor image
            const displayAvatar = item.memberProfile?.avatar_url || item.club_members?.avatar_url || item.image_url;
            const displayName = item.name || item.club_members?.name || item.memberProfile?.name || "";
            const memberInfo = item.memberProfile;
            const gender = memberInfo?.gender || 'male';

            return (
              <Card 
                key={item.id}
                className="overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-primary/50 group cursor-pointer"
                onClick={() => handleEdit(item)}
              >
                <CardContent className="p-0">
                  {/* Compact Header with Avatar and Info */}
                  <div className={`p-4 ${
                    gender === 'male' 
                      ? 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent' 
                      : 'bg-gradient-to-br from-pink-500/10 via-pink-400/5 to-transparent'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Avatar className={`h-16 w-16 border-2 border-background shadow-md ring-2 transition-all ${
                        gender === 'male'
                          ? 'ring-blue-400/30 group-hover:ring-blue-500/50'
                          : 'ring-pink-400/30 group-hover:ring-pink-500/50'
                      }`}>
                        <AvatarImage src={displayAvatar} />
                        <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                          {displayName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{displayName}</h3>
                        <p className="text-sm text-muted-foreground truncate">{item.specialty}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="default" className="text-xs">
                            Instructor
                          </Badge>
                          {item.member_id && (
                            <Badge variant="outline" className="text-xs">
                              Member
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Contact Info */}
                  {memberInfo && (memberInfo.phone || memberInfo.email) && (
                    <div className="px-4 py-2 bg-muted/30 border-y space-y-1">
                      {memberInfo.phone && (
                        <div className="flex items-center gap-2 text-xs">
                          <Phone className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="font-medium truncate">
                            {memberInfo.country_code || ''} {memberInfo.phone}
                          </span>
                        </div>
                      )}
                      {memberInfo.email && (
                        <div className="flex items-center gap-2 text-xs">
                          <Mail className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="font-medium truncate">{memberInfo.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Details Grid */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Experience</span>
                        <p className="font-semibold truncate">{item.experience}</p>
                      </div>
                      {item.rating > 0 && (
                        <div>
                          <span className="text-muted-foreground">Rating</span>
                          <p className="font-semibold">⭐ {item.rating.toFixed(1)}</p>
                        </div>
                      )}
                    </div>

                    {/* Specialty Tags */}
                    {item.specialty_tags && item.specialty_tags.length > 0 && (
                      <div className="pt-2 border-t">
                        <span className="text-xs text-muted-foreground mb-1.5 block">Skills</span>
                        <div className="flex flex-wrap gap-1">
                          {item.specialty_tags.map((tag: string, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className="text-xs px-2 py-0 h-5 rounded-full"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {memberInfo?.date_of_birth && (
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                        <div>
                          <span className="text-muted-foreground">Age</span>
                          <p className="font-semibold">{calculateAge(memberInfo.date_of_birth)} yrs</p>
                        </div>
                        {memberInfo.nationality && (
                          <div>
                            <span className="text-muted-foreground">Nationality</span>
                            <p className="font-semibold truncate">
                              {getCountryFlag(memberInfo.nationality)} {memberInfo.nationality}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Compact Action Buttons */}
                  <div className="px-4 py-3 bg-muted/20 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(item);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
    </div>
  );
};
