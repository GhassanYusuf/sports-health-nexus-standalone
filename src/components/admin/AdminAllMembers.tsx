import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Mail, Phone, User, Calendar, MapPin, Building2, UserPlus, RefreshCw, Upload, X, Plus, Trash2, Pencil, AlertCircle, Check, Loader2 } from "lucide-react";
import { formatPhoneForLookup, formatPhoneDisplay } from "@/lib/phoneUtils";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import countries from "world-countries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AdminAllMembers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberClubs, setMemberClubs] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddChildDialog, setShowAddChildDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Graduation/Degraduation dialogs
  const [showGraduateDialog, setShowGraduateDialog] = useState(false);
  const [showDegradateDialog, setShowDegradateDialog] = useState(false);
  const [graduatingChild, setGraduatingChild] = useState<any>(null);
  const [degradatingMember, setDegradatingMember] = useState<any>(null);
  
  // Graduation form fields
  const [graduateEmail, setGraduateEmail] = useState("");
  const [graduatePassword, setGraduatePassword] = useState("");
  const [graduatePhone, setGraduatePhone] = useState("");
  const [graduateCountryCode, setGraduateCountryCode] = useState("+1");
  
  // Degraduation form fields
  const [degradateParentSearch, setDegradateParentSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState<any>(null);
  
  // Edit form states
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editDOB, setEditDOB] = useState("");
  const [editNationality, setEditNationality] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editBloodType, setEditBloodType] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editEmail, setEditEmail] = useState("");
  
  // Child member form states
  const [selectedParentId, setSelectedParentId] = useState("");
  const [childName, setChildName] = useState("");
  const [childGender, setChildGender] = useState("male");
  const [childDOB, setChildDOB] = useState("");
  const [childAvatarUrl, setChildAvatarUrl] = useState("");
  const [childBloodType, setChildBloodType] = useState("dont_know");
  const [childNationality, setChildNationality] = useState("");
  
  // Parent lookup states
  const [parentLookupIdentifier, setParentLookupIdentifier] = useState("");
  const [parentSearchResults, setParentSearchResults] = useState<any[]>([]);
  const [selectedParentProfile, setSelectedParentProfile] = useState<any>(null);
  const [parentSearching, setParentSearching] = useState(false);
  const [parentSearchError, setParentSearchError] = useState("");
  const [searchMethod, setSearchMethod] = useState<'email' | 'phone' | 'name'>('name');
  
  // Form states for creating new member
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberCountryCode, setNewMemberCountryCode] = useState("+1");
  const [newMemberGender, setNewMemberGender] = useState("male");
  const [newMemberDOB, setNewMemberDOB] = useState("");
  const [newMemberNationality, setNewMemberNationality] = useState("");
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [newMemberBloodType, setNewMemberBloodType] = useState("dont_know");
  const [newMemberAvatarUrl, setNewMemberAvatarUrl] = useState("");
  
  // Child members state
  const [childMembers, setChildMembers] = useState<Array<{
    name: string;
    gender: string;
    date_of_birth: string;
    nationality: string;
    avatar_url?: string;
    blood_type?: string;
  }>>([]);

  // Image upload hook for new member
  const {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "square",
    bucket: "avatars",
    onSuccess: (url) => {
      // Check if this is for a child or the parent or editing
      if (isEditMode && selectedMember) {
        setEditAvatarUrl(url);
      } else {
        const activeChildIndex = (window as any)._activeChildUploadIndex;
        if (activeChildIndex !== undefined) {
          updateChildMember(activeChildIndex, "avatar_url", url);
          (window as any)._activeChildUploadIndex = undefined;
        } else {
          setNewMemberAvatarUrl(url);
        }
      }
    },
  });

  // Image upload hook for child member
  const {
    imageToEdit: childImageToEdit,
    isUploading: isChildUploading,
    aspectRatioType: childAspectRatioType,
    maxOutputSize: childMaxOutputSize,
    handleFileSelect: handleChildFileSelect,
    handleCropComplete: handleChildCropComplete,
    handleCloseCropper: handleChildCloseCropper,
  } = useImageUpload({
    aspectRatioType: "square",
    bucket: "avatars",
    onSuccess: (url) => setChildAvatarUrl(url),
  });

  const countryOptions = countries
    .filter((country) => country.cca2 !== "IL") // Exclude Israel
    .map((country) => ({
      label: country.name.common,
      value: country.cca2,
      icon: country.flag,
      callingCode: country.idd.root + (country.idd.suffixes?.[0] || ""),
    }));

  useEffect(() => {
    cleanupDuplicateOwnerMember();
    fetchAllMembers();
  }, []);

  // Cleanup function to remove duplicate owner member entries
  const cleanupDuplicateOwnerMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("cleanup-duplicate-member", {
        body: { scope: "self-beginner" }
      });
      if (error) throw error;
      if (data?.deleted > 0) {
        console.log(`Removed ${data.deleted} duplicate owner member record(s)`);
      }
    } catch (error) {
      console.error("Error cleaning up duplicate member:", error);
    }
  };

  const fetchAllMembers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch all children
      const { data: children, error: childrenError } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: false });

      if (childrenError) throw childrenError;

      // Get user IDs that need email lookup
      const userIds = (profiles || []).map(p => p.user_id);
      
      // Fetch emails using edge function
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const { data: emailData } = await supabase.functions.invoke('get-member-emails', {
            body: { userIds }
          });
          emailMap = emailData?.emailMap || {};
        } catch (e) {
          console.error("Error fetching emails:", e);
        }
      }

      // For each profile, get their club memberships and email
      const membersWithClubs = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: clubMemberships } = await supabase
            .from("club_members")
            .select(`
              club_id,
              rank,
              joined_date,
              clubs:club_id (
                name,
                location
              )
            `)
            .eq("user_id", profile.user_id)
            .eq("is_active", true);

          return {
            ...profile,
            email: emailMap[profile.user_id] || "",
            type: 'parent',
            clubCount: clubMemberships?.length || 0,
            clubs: clubMemberships || []
          };
        })
      );

      // Process children to show as members
      const childrenAsMembers = await Promise.all(
        (children || []).map(async (child) => {
          // Get parent's profile data
          const { data: parentProfile } = await supabase
            .from("profiles")
            .select("name, email, phone, country_code")
            .eq("user_id", child.parent_user_id)
            .single();

          // Get child's club memberships
          const { data: clubMemberships } = await supabase
            .from("club_members")
            .select(`
              club_id,
              rank,
              joined_date,
              clubs:club_id (
                name,
                location
              )
            `)
            .eq("child_id", child.id)
            .eq("is_active", true);

          return {
            id: child.id,
            name: child.name,
            avatar_url: child.avatar_url,
            gender: child.gender,
            date_of_birth: child.date_of_birth,
            blood_type: child.blood_type,
            created_at: child.created_at,
            nationality: child.nationality,
            type: 'child',
            parent_name: parentProfile?.name || "Unknown Parent",
            parent_email: emailMap[child.parent_user_id] || parentProfile?.email || "",
            parent_phone: parentProfile?.phone || "",
            parent_country_code: parentProfile?.country_code || "",
            parent_user_id: child.parent_user_id,
            clubCount: clubMemberships?.length || 0,
            clubs: clubMemberships || [],
            // Add placeholder values for consistency
            country_code: '',
            phone: '',
            user_id: null,
            email: ''
          };
        })
      );

      // Combine parents and children
      setMembers([...membersWithClubs, ...childrenAsMembers]);
    } catch (error: any) {
      toast({
        title: "Error loading members",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewMember = async (member: any) => {
    setSelectedMember(member);
    setMemberClubs(member.clubs);
    setIsEditMode(false);
    // Populate edit form
    setEditName(member.name || "");
    setEditPhone(member.phone || "");
    setEditCountryCode(member.country_code || "");
    setEditGender(member.gender || "");
    setEditDOB(member.date_of_birth || "");
    setEditAddress(member.address || "");
    setEditBloodType(member.blood_type || "");
    setEditAvatarUrl(member.avatar_url || "");
    setEditEmail(member.email || "");
    
    // For child members, if nationality is not set, fetch parent's nationality
    if (member.type === 'child' && !member.nationality && member.parent_user_id) {
      const { data: parentProfile } = await supabase
        .from("profiles")
        .select("nationality")
        .eq("user_id", member.parent_user_id)
        .maybeSingle();
      
      setEditNationality(parentProfile?.nationality || "");
    } else {
      setEditNationality(member.nationality || "");
    }
  };

  const handleEditMember = async (member: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMember(member);
    setMemberClubs(member.clubs);
    setIsEditMode(true);
    // Populate edit form
    setEditName(member.name || "");
    setEditPhone(member.phone || "");
    setEditCountryCode(member.country_code || "");
    setEditGender(member.gender || "");
    setEditDOB(member.date_of_birth || "");
    setEditAddress(member.address || "");
    setEditBloodType(member.blood_type || "");
    setEditAvatarUrl(member.avatar_url || "");
    setEditEmail(member.email || "");
    
    // For child members, if nationality is not set, fetch parent's nationality
    if (member.type === 'child' && !member.nationality && member.parent_user_id) {
      const { data: parentProfile } = await supabase
        .from("profiles")
        .select("nationality")
        .eq("user_id", member.parent_user_id)
        .maybeSingle();
      
      setEditNationality(parentProfile?.nationality || "");
    } else {
      setEditNationality(member.nationality || "");
    }
  };

  const handleDeleteMember = async (member: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete ${member.name}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      if (member.type === 'child') {
        const { error } = await supabase
          .from("children")
          .delete()
          .eq("id", member.id);

        if (error) throw error;
      } else {
        // For parent members, call edge function to delete securely
        const { data, error } = await supabase.functions.invoke('delete-member', {
          body: { userId: member.user_id },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast({
        title: "Member deleted",
        description: `${member.name} has been removed from the system`,
      });

      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error deleting member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openGraduateDialog = (member: any) => {
    if (member.type !== 'child') {
      toast({
        title: "Error",
        description: "This member is already an adult",
        variant: "destructive",
      });
      return;
    }
    setGraduatingChild(member);
    setGraduateEmail("");
    setGraduatePassword("");
    setGraduatePhone(member.parent_phone || "");
    setGraduateCountryCode(member.parent_country_code || "+1");
    setShowGraduateDialog(true);
  };

  const handleGraduateChild = async () => {
    if (!graduatingChild || !graduateEmail || !graduatePassword || !graduatePhone) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("graduate-child", {
        body: {
          child_id: graduatingChild.id,
          email: graduateEmail,
          password: graduatePassword,
          phone: graduatePhone,
          country_code: graduateCountryCode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Child Graduated",
        description: `${graduatingChild.name} is now an independent adult member. ${data.transferred_memberships || 0} memberships transferred.`,
      });

      setShowGraduateDialog(false);
      setGraduatingChild(null);
      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDegradateDialog = (member: any) => {
    if (member.type === 'child') {
      toast({
        title: "Error",
        description: "This member is already a child",
        variant: "destructive",
      });
      return;
    }
    setDegradatingMember(member);
    setDegradateParentSearch("");
    setSelectedParent(null);
    setShowDegradateDialog(true);
  };

  const handleSearchParent = async () => {
    if (!degradateParentSearch.trim()) {
      toast({
        title: "Error",
        description: "Please enter parent email or phone",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`email.ilike.${degradateParentSearch},phone.eq.${degradateParentSearch}`)
        .limit(1);

      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        toast({
          title: "Not Found",
          description: "No parent found with that email or phone",
          variant: "destructive",
        });
        return;
      }

      setSelectedParent(profiles[0]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDegradateMember = async () => {
    if (!degradatingMember || !selectedParent) {
      toast({
        title: "Error",
        description: "Please select a parent",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("degraduate-member", {
        body: {
          user_id: degradatingMember.user_id,
          parent_user_id: selectedParent.user_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Member Degraduated",
        description: `${degradatingMember.name} is now managed as a child by ${selectedParent.name}. ${data.transferred_memberships || 0} memberships transferred.`,
      });

      setShowDegradateDialog(false);
      setDegradatingMember(null);
      setSelectedParent(null);
      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;

    setLoading(true);
    try {
      if (selectedMember.type === 'child') {
        // Update child member
        const { error } = await supabase
          .from("children")
          .update({
            name: editName,
            gender: editGender,
            date_of_birth: editDOB,
            blood_type: editBloodType || null,
            avatar_url: editAvatarUrl || null,
            nationality: editNationality,
          })
          .eq("id", selectedMember.id);

        if (error) throw error;
      } else {
        // Update email using edge function if it changed
        if (editEmail && editEmail !== selectedMember.email) {
          const { data: emailUpdateData, error: emailError } = await supabase.functions.invoke('update-member-email', {
            body: {
              userId: selectedMember.user_id,
              email: editEmail
            }
          });
          
          if (emailError) throw emailError;
          if (emailUpdateData?.error) throw new Error(emailUpdateData.error);
        }

        // Update parent profile via secure edge function (admin privileges)
        const { data: profileUpdateData, error: profileUpdateError } = await supabase.functions.invoke('update-member-profile', {
          body: {
            userId: selectedMember.user_id,
            profile: {
              name: editName,
              phone: editPhone,
              country_code: editCountryCode,
              gender: editGender,
              date_of_birth: editDOB,
              nationality: editNationality,
              address: editAddress || null,
              blood_type: editBloodType || null,
              avatar_url: editAvatarUrl || null,
              email: editEmail || null,
            },
          },
        });

        if (profileUpdateError) throw profileUpdateError;
        if (profileUpdateData?.error) throw new Error(profileUpdateData.error);
      }

      toast({
        title: "Member updated",
        description: `${editName}'s information has been updated successfully`,
      });

      // Close dialog first
      setIsEditMode(false);
      setSelectedMember(null);
      
      // Then refresh data in the background
      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error updating member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const tempId = selectedMember?.user_id || selectedMember?.id || crypto.randomUUID();
    await handleFileSelect(file, tempId, "profile");
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewMemberPassword(password);
    toast({
      title: "Password generated",
      description: "A secure password has been generated",
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Use temporary ID for upload path before user is created
    const tempId = crypto.randomUUID();
    await handleFileSelect(file, tempId, "profile");
  };

  const handleChildAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const tempId = crypto.randomUUID();
    await handleChildFileSelect(file, tempId, "child");
  };

  const addChildMember = () => {
    setChildMembers([...childMembers, { 
      name: "", 
      gender: "male", 
      date_of_birth: "", 
      nationality: newMemberNationality || "",
      avatar_url: "", 
      blood_type: "dont_know" 
    }]);
  };

  const removeChildMember = (index: number) => {
    setChildMembers(childMembers.filter((_, i) => i !== index));
  };

  const updateChildMember = (index: number, field: string, value: string) => {
    const updated = [...childMembers];
    updated[index] = { ...updated[index], [field]: value };
    setChildMembers(updated);
  };

  const handleCreateMember = async () => {
    if (!newMemberEmail || !newMemberPassword || !newMemberName || !newMemberPhone || 
        !newMemberGender || !newMemberDOB || !newMemberNationality) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Prepare valid children
      const validChildren = childMembers.filter(
        (child) => child.name && child.gender && child.date_of_birth && child.nationality
      );

      // Call edge function to create member securely
      const { data, error } = await supabase.functions.invoke('create-member', {
        body: {
          email: newMemberEmail,
          password: newMemberPassword,
          name: newMemberName,
          phone: newMemberPhone,
          country_code: newMemberCountryCode,
          gender: newMemberGender,
          date_of_birth: newMemberDOB,
          nationality: newMemberNationality,
          address: newMemberAddress || null,
          blood_type: newMemberBloodType || null,
          avatar_url: newMemberAvatarUrl || null,
          children: validChildren.length > 0 ? validChildren : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Member created",
        description: `${newMemberName} has been added to the platform`,
      });

      setShowCreateDialog(false);
      resetCreateForm();
      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error creating member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewMemberEmail("");
    setNewMemberPassword("");
    setNewMemberName("");
    setNewMemberPhone("");
    setNewMemberCountryCode("+1");
    setNewMemberGender("male");
    setNewMemberDOB("");
    setNewMemberNationality("");
    setNewMemberAddress("");
    setNewMemberBloodType("dont_know");
    setNewMemberAvatarUrl("");
    setChildMembers([]);
  };

  const resetChildForm = () => {
    setSelectedParentId("");
    setChildName("");
    setChildGender("male");
    setChildDOB("");
    setChildAvatarUrl("");
    setChildBloodType("dont_know");
    setChildNationality("");
    clearSelectedParent();
  };

  const handleParentLookup = async (identifier: string) => {
    if (!identifier.trim()) {
      setParentSearchResults([]);
      setParentSearchError("");
      setSelectedParentProfile(null);
      setSelectedParentId("");
      return;
    }

    setParentSearching(true);
    setParentSearchError("");
    
    try {
      const formattedIdentifier = formatPhoneForLookup(identifier);
      const { data: profilesData, error } = await supabase
        .rpc('lookup_profile_for_login', { identifier: formattedIdentifier });

      if (error) throw error;

      if (!profilesData || profilesData.length === 0) {
        setParentSearchError("No parent found. Try email, phone, or name.");
        setParentSearchResults([]);
        setSelectedParentProfile(null);
        setSelectedParentId("");
      } else {
        // If single result, auto-select it
        if (profilesData.length === 1) {
          const profile = profilesData[0];
          setSelectedParentProfile(profile);
          setSelectedParentId(profile.user_id);
          setParentSearchResults([]);
          
          // Auto-fill child nationality from parent
          if (profile.nationality) {
            setChildNationality(profile.nationality);
          }
        } else {
          // Multiple results (name search)
          setParentSearchResults(profilesData);
          setSelectedParentProfile(null);
          setSelectedParentId("");
        }
        setParentSearchError("");
      }
    } catch (err) {
      console.error("Parent lookup error:", err);
      setParentSearchError("Error searching for parent");
      setParentSearchResults([]);
    } finally {
      setParentSearching(false);
    }
  };

  // Select parent from multiple results
  const selectParent = (profile: any) => {
    setSelectedParentProfile(profile);
    setSelectedParentId(profile.user_id);
    setParentSearchResults([]);
    
    if (profile.nationality) {
      setChildNationality(profile.nationality);
    }
  };

  // Clear selected parent
  const clearSelectedParent = () => {
    setSelectedParentProfile(null);
    setSelectedParentId("");
    setParentLookupIdentifier("");
    setParentSearchResults([]);
    setParentSearchError("");
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (parentLookupIdentifier.trim().length >= 2) {
        handleParentLookup(parentLookupIdentifier);
      }
    }, 400);
    
    return () => clearTimeout(timer);
  }, [parentLookupIdentifier]);

  const handleAddChild = async () => {
    // Validate parent is selected
    if (!selectedParentId || !selectedParentProfile) {
      toast({
        title: "Parent Required",
        description: "Please search and select a parent account first",
        variant: "destructive"
      });
      return;
    }

    if (!childName || !childGender || !childDOB || !childNationality) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields including nationality",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("children")
        .insert({
          parent_user_id: selectedParentId,
          name: childName,
          gender: childGender,
          date_of_birth: childDOB,
          avatar_url: childAvatarUrl || null,
          blood_type: childBloodType || null,
          nationality: childNationality,
        });

      if (error) throw error;

      toast({
        title: "Child member added",
        description: `${childName} has been added successfully`,
      });

      setShowAddChildDialog(false);
      resetChildForm();
      fetchAllMembers();
    } catch (error: any) {
      toast({
        title: "Error adding child",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCountryName = (code: string) => {
    const country = countries.find((c) => c.cca2 === code);
    return country ? `${country.flag} ${country.name.common}` : code;
  };

  const getCountryFlag = (code: string) => {
    if (!code) return null;
    const country = countries.find((c) => c.cca2 === code);
    return country?.flag || null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  const calculateTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return remainingMonths > 0 
        ? `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
        : `${years} year${years > 1 ? 's' : ''}`;
    }
  };

  const getHoroscope = (dateOfBirth: string) => {
    const date = new Date(dateOfBirth);
    const day = date.getDate();
    const month = date.getMonth() + 1;

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return { sign: 'Aries', emoji: '♈' };
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return { sign: 'Taurus', emoji: '♉' };
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return { sign: 'Gemini', emoji: '♊' };
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return { sign: 'Cancer', emoji: '♋' };
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return { sign: 'Leo', emoji: '♌' };
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return { sign: 'Virgo', emoji: '♍' };
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return { sign: 'Libra', emoji: '♎' };
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return { sign: 'Scorpio', emoji: '♏' };
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return { sign: 'Sagittarius', emoji: '♐' };
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return { sign: 'Capricorn', emoji: '♑' };
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return { sign: 'Aquarius', emoji: '♒' };
    return { sign: 'Pisces', emoji: '♓' };
  };

  const getNextBirthdayCountdown = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    
    if (months === 0) {
      return `${days}d`;
    }
    return `${months}m ${days}d`;
  };

  const generateMemberCode = (member: any) => {
    if (member.type === 'child') {
      // Generate child code
      const childPrefix = 'CHILD';
      const idPart = member.id.slice(0, 8).toUpperCase();
      return `${childPrefix}-${idPart}`;
    } else {
      // Generate member code
      const memberPrefix = 'MEM';
      const idPart = member.user_id?.slice(0, 8).toUpperCase() || member.id.slice(0, 8).toUpperCase();
      return `${memberPrefix}-${idPart}`;
    }
  };

  const getGenderIcon = (gender: string) => {
    if (gender.toLowerCase() === 'male') {
      return <div className="text-blue-500 font-bold text-sm">♂</div>;
    } else {
      return <div className="text-pink-500 font-bold text-sm">♀</div>;
    }
  };

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    
    // For children, also check combined "child name + parent name"
    const combinedChildName = member.type === 'child' && member.parent_name
      ? `${member.name} ${member.parent_name}`.toLowerCase()
      : '';
    
    // Check if member matches the search query
    const memberMatches = (
      member.name?.toLowerCase().includes(query) ||
      member.phone?.includes(query) ||
      member.nationality?.toLowerCase().includes(query) ||
      member.gender?.toLowerCase().includes(query) ||
      member.parent_name?.toLowerCase().includes(query) ||
      combinedChildName.includes(query)
    );
    
    // If member matches, show them
    if (memberMatches) return true;
    
    // If searching by parent phone, also show their children
    if (member.type === 'child' && member.parent_phone?.includes(query)) {
      return true;
    }
    
    // If this is a parent and their phone matches, check if we should show them
    // because one of their children might be in the results
    if (member.type === 'parent' && member.phone?.includes(query)) {
      return true;
    }
    
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading members...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Members Management</h2>
            <p className="text-muted-foreground">Manage all registered users across the platform</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddChildDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Child Member</span>
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Member</span>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search members by name, phone, nationality, or gender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {filteredMembers.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No members found. Create your first member to get started.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMembers.filter((m) => !!m?.name).map((member) => (
              <Card 
                key={member.id}
                className="overflow-hidden hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 group cursor-pointer"
                onClick={() => handleViewMember(member)}
              >
                <CardContent className="p-0">
                  {/* Header with Avatar */}
                  <div className={`p-6 pb-4 ${
                    member.gender === 'male' 
                      ? 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent' 
                      : 'bg-gradient-to-br from-pink-500/10 via-pink-400/5 to-transparent'
                  }`}>
                    <div className="flex items-start gap-4">
                      <Avatar className={`h-20 w-20 border-4 border-background shadow-lg ring-2 transition-all ${
                        member.gender === 'male'
                          ? 'ring-blue-400/30 group-hover:ring-blue-500/50'
                          : 'ring-pink-400/30 group-hover:ring-pink-500/50'
                      }`}>
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                          {member.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xl truncate">
                          {member.name}
                        </div>
                        {member.type === 'child' && member.parent_name && (
                          <div className="text-sm text-muted-foreground font-medium mt-1">
                            Parent: {member.parent_name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant={member.type === 'child' ? 'secondary' : 'default'} className="font-semibold">
                            {member.type === 'child' ? 'Child' : 'Adult'}
                          </Badge>
                          <Badge variant="outline" className="font-medium">
                            {member.clubCount} {member.clubCount === 1 ? 'Club' : 'Clubs'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {(member.type === 'parent' && member.phone) || (member.type === 'child' && member.parent_phone) ? (
                    <div className="px-6 py-3 bg-muted/30 border-y">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {member.type === 'parent' 
                            ? `${member.country_code || ''} ${member.phone || ''}`
                            : `Parent: ${member.parent_country_code || ''} ${member.parent_phone || ''}`
                          }
                        </span>
                      </div>
                      {member.type === 'parent' && member.email && (
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Mail className="h-4 w-4 text-primary" />
                          <span className="font-medium truncate">{member.email}</span>
                        </div>
                      )}
                      {member.type === 'child' && member.parent_email && (
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Mail className="h-4 w-4 text-primary" />
                          <span className="font-medium truncate">Parent: {member.parent_email}</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Member Details */}
                  {member.date_of_birth && (
                    <div className="px-6 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Gender
                          </div>
                          <div className="font-semibold capitalize">
                            {member.gender || "N/A"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Age
                          </div>
                          <div className="font-semibold">
                            {calculateAge(member.date_of_birth)} years
                          </div>
                        </div>
                      </div>

                      {member.nationality && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                              Nationality
                            </div>
                            <div className="font-semibold text-lg">
                              {getCountryFlag(member.nationality)} {member.nationality}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                              Horoscope
                            </div>
                            <div className="font-semibold">
                              {getHoroscope(member.date_of_birth).emoji} {getHoroscope(member.date_of_birth).sign}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground font-medium">Next Birthday</span>
                          <span className="font-semibold text-primary">
                            {getNextBirthdayCountdown(member.date_of_birth)}
                          </span>
                        </div>
                        {member.created_at && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-medium">Member Since</span>
                            <span className="font-semibold">
                              {formatDate(member.created_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="px-6 py-4 bg-muted/20 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => handleEditMember(member, e)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDeleteMember(member, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Member Details/Edit Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => {
        setSelectedMember(null);
        setIsEditMode(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold">
              {isEditMode ? 'Edit Member Profile' : (selectedMember?.type === 'child' ? 'Child Member Details' : 'Member Details')}
            </DialogTitle>
            {isEditMode && (
              <DialogDescription className="text-base">
                Update member information and profile details
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedMember && (
            <div className="flex-1 overflow-y-auto">
              {!isEditMode ? (
                // View Mode
                <div className="space-y-6 p-6">
                  {/* Profile Header */}
                  <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-6">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                          <AvatarImage src={selectedMember.avatar_url} />
                          <AvatarFallback className="text-2xl">
                            <User className="h-10 w-10" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-2xl font-bold">{selectedMember.name}</h3>
                            {selectedMember.type === 'child' && (
                              <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 border-blue-500/30 px-3 py-1">
                                Child Member
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {selectedMember.type === 'child' ? (
                              <>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Parent</p>
                                    <p className="text-sm font-semibold text-foreground">{selectedMember.parent_name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <Calendar className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Date of Birth</p>
                                    <p className="text-sm font-semibold text-foreground">{formatDate(selectedMember.date_of_birth)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Gender</p>
                                    <p className="text-sm font-semibold text-foreground capitalize">{selectedMember.gender}</p>
                                  </div>
                                </div>
                                {selectedMember.blood_type && (
                                  <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="p-2 rounded-full bg-background">
                                      <User className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium">Blood Type</p>
                                      <p className="text-sm font-semibold text-foreground">{selectedMember.blood_type}</p>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <Phone className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Phone</p>
                                    <p className="text-sm font-semibold text-foreground">{selectedMember.country_code} {selectedMember.phone}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Nationality</p>
                                    <p className="text-sm font-semibold text-foreground">{getCountryName(selectedMember.nationality)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Gender</p>
                                    <p className="text-sm font-semibold text-foreground capitalize">{selectedMember.gender}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <div className="p-2 rounded-full bg-background">
                                    <Calendar className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium">Date of Birth</p>
                                    <p className="text-sm font-semibold text-foreground">{formatDate(selectedMember.date_of_birth)}</p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Information */}
                  {selectedMember.address && selectedMember.type !== 'child' && (
                    <Card>
                      <CardContent className="p-6">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">ADDRESS</h4>
                        <p className="text-base">{selectedMember.address}</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedMember.fitness_goal && selectedMember.type !== 'child' && (
                    <Card>
                      <CardContent className="p-6">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">FITNESS GOAL</h4>
                        <p className="text-base">{selectedMember.fitness_goal}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Club Memberships */}
                  {selectedMember.type !== 'child' && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Club Memberships
                          </h4>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {memberClubs.length}
                          </Badge>
                        </div>
                        {memberClubs.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Not affiliated with any clubs yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {memberClubs.map((membership: any, idx: number) => (
                              <Card key={idx} className="border-2 hover:border-primary/50 transition-colors">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                      <div className="p-2 rounded-full bg-primary/10">
                                        <Building2 className="h-5 w-5 text-primary" />
                                      </div>
                                      <div>
                                        <p className="font-semibold text-base mb-1">
                                          {membership.clubs?.name || "Unknown Club"}
                                        </p>
                                        {membership.clubs?.location && (
                                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {membership.clubs.location}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <Badge variant="outline" className="mb-2">{membership.rank}</Badge>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(membership.joined_date)}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                // Edit Mode
                <div className="space-y-6 p-6">
                  {/* Profile Picture Upload */}
                  <div className="space-y-2">
                    <Label>Profile Picture *</Label>
                    <div className="flex items-center gap-4">
                      {editAvatarUrl ? (
                        <div className="relative">
                          <Avatar className="h-24 w-24">
                            <AvatarImage src={editAvatarUrl} />
                            <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                          </Avatar>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => setEditAvatarUrl("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleEditAvatarUpload}
                          disabled={isUploading}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload a profile picture with zoom, pan, and crop options
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedMember.type !== 'child' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email *</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="member@example.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Changing the email will update the login credentials
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name *</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  {selectedMember.type !== 'child' && (
                    <>
                      <div className="space-y-2">
                        <Label>Phone Number *</Label>
                        <PhoneInput
                          phoneNumber={editPhone}
                          countryCode={editCountryCode}
                          onCountryCodeChange={setEditCountryCode}
                          onPhoneNumberChange={setEditPhone}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-gender">Gender *</Label>
                        <Select value={editGender} onValueChange={setEditGender}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-dob">Date of Birth *</Label>
                        <Input
                          id="edit-dob"
                          type="date"
                          value={editDOB}
                          onChange={(e) => setEditDOB(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-nationality">Nationality *</Label>
                        <SearchableSelect
                          value={editNationality}
                          onValueChange={setEditNationality}
                          options={countryOptions}
                          placeholder="Select nationality"
                          searchPlaceholder="Search countries..."
                          emptyMessage="No country found."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-blood-type">Blood Type (Optional)</Label>
                        <Select value={editBloodType} onValueChange={setEditBloodType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dont_know">Don't Know</SelectItem>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-address">Address</Label>
                        <Input
                          id="edit-address"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          placeholder="Street address"
                        />
                      </div>

                      {/* Child Members Section */}
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-base font-semibold">Child Members</Label>
                            <p className="text-sm text-muted-foreground">
                              Children associated with this member
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddChildDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Child
                          </Button>
                        </div>

                        {members.filter(m => m.type === 'child' && m.parent_user_id === selectedMember.user_id).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No child members added yet. Click "Add Child" to create one.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {members.filter(m => m.type === 'child' && m.parent_user_id === selectedMember.user_id).map((child, index) => (
                              <Card key={child.id} className="p-3 bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarImage src={child.avatar_url} />
                                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{child.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {child.gender} • {child.date_of_birth ? calculateAge(child.date_of_birth) : 'N/A'} years old
                                      {child.blood_type && child.blood_type !== 'dont_know' && ` • ${child.blood_type}`}
                                    </p>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedMember.type === 'child' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="edit-gender">Gender *</Label>
                        <Select value={editGender} onValueChange={setEditGender}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-dob">Date of Birth *</Label>
                        <Input
                          id="edit-dob"
                          type="date"
                          value={editDOB}
                          onChange={(e) => setEditDOB(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-nationality">Nationality *</Label>
                        <SearchableSelect
                          value={editNationality}
                          onValueChange={setEditNationality}
                          options={countryOptions}
                          placeholder="Select nationality"
                          searchPlaceholder="Search countries..."
                          emptyMessage="No country found."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-blood-type">Blood Type (Optional)</Label>
                        <Select value={editBloodType} onValueChange={setEditBloodType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dont_know">Don't Know</SelectItem>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditMode(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateMember} disabled={loading}>
                      {loading ? "Saving..." : "Update Member"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Member Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Member</DialogTitle>
            <DialogDescription>
              Create a new user account and profile on the platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Profile Picture Upload */}
            <div className="space-y-2">
              <Label>Profile Picture *</Label>
              <div className="flex items-center gap-4">
                {newMemberAvatarUrl ? (
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={newMemberAvatarUrl} />
                      <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setNewMemberAvatarUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a profile picture with zoom, pan, and crop options
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="member@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  type="text"
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click generate for a secure auto-generated password
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Full Name *</Label>
              <Input
                id="new-name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <PhoneInput
                phoneNumber={newMemberPhone}
                countryCode={newMemberCountryCode}
                onCountryCodeChange={setNewMemberCountryCode}
                onPhoneNumberChange={setNewMemberPhone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-gender">Gender *</Label>
              <Select value={newMemberGender} onValueChange={setNewMemberGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-dob">Date of Birth *</Label>
              <Input
                id="new-dob"
                type="date"
                value={newMemberDOB}
                onChange={(e) => setNewMemberDOB(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-nationality">Nationality *</Label>
              <SearchableSelect
                value={newMemberNationality}
                onValueChange={setNewMemberNationality}
                options={countryOptions}
                placeholder="Select nationality"
                searchPlaceholder="Search countries..."
                emptyMessage="No country found."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-blood-type">Blood Type (Optional)</Label>
              <Select value={newMemberBloodType} onValueChange={setNewMemberBloodType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dont_know">Don't Know</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-address">Address</Label>
              <Input
                id="new-address"
                value={newMemberAddress}
                onChange={(e) => setNewMemberAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>

            {/* Child Members Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Child Members</Label>
                  <p className="text-sm text-muted-foreground">
                    Add children associated with this member
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChildMember}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Child
                </Button>
              </div>

              {childMembers.map((child, index) => (
                <Card key={index} className="p-4 bg-muted/30">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">Child {index + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChildMember(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Profile Picture for Child */}
                    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card/50">
                      {child.avatar_url ? (
                        <div className="relative group">
                          <Avatar className="h-20 w-20 ring-2 ring-primary/10">
                            <AvatarImage src={child.avatar_url} className="object-cover" />
                            <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                          </Avatar>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => updateChildMember(index, "avatar_url", "")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-lg bg-muted/30">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Profile Picture</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const tempId = crypto.randomUUID();
                            // Set the active child index for the upload callback
                            (window as any)._activeChildUploadIndex = index;
                            await handleFileSelect(file, tempId, `child-${index}`);
                          }}
                          disabled={isUploading}
                          className="cursor-pointer text-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload with zoom, pan & crop
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={child.name}
                          onChange={(e) => updateChildMember(index, "name", e.target.value)}
                          placeholder="Child's name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Gender</Label>
                        <Select
                          value={child.gender}
                          onValueChange={(value) => updateChildMember(index, "gender", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date of Birth</Label>
                        <Input
                          type="date"
                          value={child.date_of_birth}
                          onChange={(e) => updateChildMember(index, "date_of_birth", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Nationality *</Label>
                        <SearchableSelect
                          value={child.nationality}
                          onValueChange={(value) => updateChildMember(index, "nationality", value)}
                          options={countryOptions}
                          placeholder="Select nationality"
                          searchPlaceholder="Search countries..."
                          emptyMessage="No country found."
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Blood Type (Optional)</Label>
                        <Select
                          value={child.blood_type}
                          onValueChange={(value) => updateChildMember(index, "blood_type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dont_know">Don't Know</SelectItem>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {childMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No child members added yet. Click "Add Child" to create one.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMember} disabled={loading}>
              {loading ? "Creating..." : "Create Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Child Member Dialog - REDESIGNED */}
      <Dialog open={showAddChildDialog} onOpenChange={setShowAddChildDialog}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
          {/* Header with gradient accent */}
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Add Child Member
                </DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Search for the parent account and create a child profile
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-8">
              
              {/* PARENT LOOKUP SECTION - REDESIGNED */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
                  <h3 className="text-lg font-bold text-foreground">Parent Account Lookup</h3>
                </div>
                
                {/* Search Tabs */}
                <div className="flex gap-2 p-1.5 bg-muted/50 rounded-xl border border-border/50">
                  <Button
                    type="button"
                    variant={searchMethod === 'name' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setSearchMethod('name');
                      setParentLookupIdentifier("");
                      clearSelectedParent();
                    }}
                    className="flex-1 transition-all"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Name
                  </Button>
                  <Button
                    type="button"
                    variant={searchMethod === 'email' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setSearchMethod('email');
                      setParentLookupIdentifier("");
                      clearSelectedParent();
                    }}
                    className="flex-1 transition-all"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={searchMethod === 'phone' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setSearchMethod('phone');
                      setParentLookupIdentifier("");
                      clearSelectedParent();
                    }}
                    className="flex-1 transition-all"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Phone
                  </Button>
                </div>

                {/* Search Input */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    {searchMethod === 'name' && <><User className="h-4 w-4 text-primary" />Parent Name</>}
                    {searchMethod === 'email' && <><Mail className="h-4 w-4 text-primary" />Parent Email</>}
                    {searchMethod === 'phone' && <><Phone className="h-4 w-4 text-primary" />Parent Phone</>}
                    <span className="text-destructive">*</span>
                  </Label>
                  
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder={
                        searchMethod === 'name' 
                          ? "Start typing parent's name..." 
                          : searchMethod === 'email'
                          ? "name@example.com"
                          : "33791210"
                      }
                      value={parentLookupIdentifier}
                      onChange={(e) => setParentLookupIdentifier(e.target.value)}
                      className="h-14 text-base pl-12 pr-12 bg-muted/30 border-border/50 focus:bg-background focus:border-primary transition-all"
                      autoFocus
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Search className={`h-5 w-5 transition-colors ${parentSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                    </div>
                    {parentSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">💡</span>
                    {searchMethod === 'name' && "Search by first name, last name, or full name"}
                    {searchMethod === 'email' && "Enter the parent's email address"}
                    {searchMethod === 'phone' && "Enter phone number without country code"}
                  </p>

                  {/* Error Message */}
                  {parentSearchError && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      <p className="text-sm text-destructive">{parentSearchError}</p>
                    </div>
                  )}

                  {/* Multiple Results (Name Search) */}
                  {parentSearchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Found {parentSearchResults.length} result{parentSearchResults.length > 1 ? 's' : ''}:
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {parentSearchResults.map((profile) => (
                          <Card
                            key={profile.user_id}
                            className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
                            onClick={() => selectParent(profile)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-14 w-14 ring-2 ring-border group-hover:ring-primary/30 transition-all">
                                  <AvatarImage src={profile.avatar_url} />
                                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                                    {profile.name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-base truncate">{profile.name}</div>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{profile.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{formatPhoneDisplay(profile.phone)}</span>
                                  </div>
                                </div>
                                <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                  →
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Parent Card */}
                  {selectedParentProfile && (
                    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <Avatar className="h-16 w-16 ring-4 ring-primary/20">
                              <AvatarImage src={selectedParentProfile.avatar_url} />
                              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                                {selectedParentProfile.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                              <Check className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="font-bold text-lg">{selectedParentProfile.name}</div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearSelectedParent}
                                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate">{selectedParentProfile.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{formatPhoneDisplay(selectedParentProfile.phone)}</span>
                              </div>
                              {selectedParentProfile.nationality && (
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{selectedParentProfile.nationality}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Only show child form if parent is selected */}
              {selectedParentProfile && (
                <>
                  {/* PROFILE PICTURE SECTION - REDESIGNED */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-1 rounded-full bg-gradient-to-b from-accent to-accent/40" />
                      <h3 className="text-lg font-bold text-foreground">Profile Picture</h3>
                    </div>
                    <Card className="border-border/50 bg-gradient-to-br from-muted/30 to-transparent">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-6">
                          {childAvatarUrl ? (
                            <div className="relative group">
                              <Avatar className="h-32 w-32 ring-4 ring-accent/20 shadow-xl">
                                <AvatarImage src={childAvatarUrl} className="object-cover" />
                                <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                              </Avatar>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                onClick={() => setChildAvatarUrl("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-border/50 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
                              <Upload className="h-12 w-12 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex-1 space-y-3">
                            <Label className="text-sm font-semibold">Upload Child's Photo</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleChildAvatarUpload}
                              disabled={isChildUploading}
                              className="cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-4 file:py-2 file:mr-4"
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="text-accent">✨</span>
                              Supports zoom, pan, and crop features
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* PERSONAL INFORMATION - REDESIGNED */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
                      <h3 className="text-lg font-bold text-foreground">Personal Information</h3>
                    </div>
                    <Card className="border-border/50 bg-gradient-to-br from-muted/30 to-transparent">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Full Name */}
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="child-name" className="text-sm font-semibold">
                              Full Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="child-name"
                              value={childName}
                              onChange={(e) => setChildName(e.target.value)}
                              placeholder="Enter child's full name"
                              className="h-12 bg-background/50"
                            />
                          </div>

                          {/* Gender */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">
                              Gender <span className="text-destructive">*</span>
                            </Label>
                            <Select value={childGender} onValueChange={setChildGender}>
                              <SelectTrigger className="h-12 bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Date of Birth */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">
                              Date of Birth <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="date"
                              value={childDOB}
                              onChange={(e) => setChildDOB(e.target.value)}
                              className="h-12 bg-background/50"
                            />
                          </div>

                          {/* Nationality */}
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-semibold">
                              Nationality <span className="text-destructive">*</span>
                            </Label>
                            <SearchableSelect
                              value={childNationality}
                              onValueChange={setChildNationality}
                              options={countryOptions}
                              placeholder="Select nationality"
                              searchPlaceholder="Search countries..."
                              emptyMessage="No country found."
                            />
                          </div>

                          {/* Blood Type */}
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-semibold">Blood Type (Optional)</Label>
                            <Select value={childBloodType} onValueChange={setChildBloodType}>
                              <SelectTrigger className="h-12 bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dont_know">Don't Know</SelectItem>
                                <SelectItem value="A+">A+</SelectItem>
                                <SelectItem value="A-">A-</SelectItem>
                                <SelectItem value="B+">B+</SelectItem>
                                <SelectItem value="B-">B-</SelectItem>
                                <SelectItem value="AB+">AB+</SelectItem>
                                <SelectItem value="AB-">AB-</SelectItem>
                                <SelectItem value="O+">O+</SelectItem>
                                <SelectItem value="O-">O-</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Modern Footer */}
          <DialogFooter className="px-8 py-6 border-t border-border/50 bg-gradient-to-r from-muted/20 via-transparent to-muted/20">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddChildDialog(false);
                  clearSelectedParent();
                }}
                className="flex-1 sm:flex-initial h-12"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddChild} 
                disabled={loading || isChildUploading || !selectedParentId || !childName || !childDOB}
                className="flex-1 sm:flex-initial h-12 bg-gradient-primary shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Child Member
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Graduate Child Dialog */}
      <Dialog open={showGraduateDialog} onOpenChange={setShowGraduateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Graduate Child to Adult Member</DialogTitle>
            <DialogDescription>
              {graduatingChild?.name} will become an independent adult member with their own account.
              All their membership history and skills will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="graduate-email">Email Address *</Label>
              <Input
                id="graduate-email"
                type="email"
                placeholder="member@example.com"
                value={graduateEmail}
                onChange={(e) => setGraduateEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduate-password">Password *</Label>
              <Input
                id="graduate-password"
                type="password"
                placeholder="Create a strong password"
                value={graduatePassword}
                onChange={(e) => setGraduatePassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduate-phone">Phone Number *</Label>
              <PhoneInput
                phoneNumber={graduatePhone}
                countryCode={graduateCountryCode}
                onPhoneNumberChange={setGraduatePhone}
                onCountryCodeChange={setGraduateCountryCode}
              />
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>New user account will be created</li>
                <li>All active memberships will be transferred</li>
                <li>All membership history will remain linked</li>
                <li>Child record stays for historical reference</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGraduateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGraduateChild}
              disabled={loading}
            >
              {loading ? "Processing..." : "Graduate to Adult"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Degraduate Member Dialog */}
      <Dialog open={showDegradateDialog} onOpenChange={setShowDegradateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move Adult to Child Status</DialogTitle>
            <DialogDescription>
              {degradatingMember?.name} will be managed as a child by a parent member.
              All their membership history and skills will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-search">Parent Email or Phone *</Label>
              <div className="flex gap-2">
                <Input
                  id="parent-search"
                  placeholder="parent@example.com or phone number"
                  value={degradateParentSearch}
                  onChange={(e) => setDegradateParentSearch(e.target.value)}
                />
                <Button 
                  variant="outline" 
                  onClick={handleSearchParent}
                  disabled={!degradateParentSearch.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedParent && (
              <Card className="bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedParent.avatar_url} />
                      <AvatarFallback>
                        {selectedParent.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{selectedParent.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedParent.phone}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Child record will be created/updated</li>
                <li>All active memberships will be transferred</li>
                <li>All membership history will remain linked</li>
                <li>Auth account will be disabled (preserved)</li>
                <li>Parent will manage all registrations</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDegradateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDegradateMember}
              disabled={loading || !selectedParent}
            >
              {loading ? "Processing..." : "Move to Child Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Cropper Modals */}
      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          aspectRatioType={aspectRatioType}
          onCropComplete={handleCropComplete}
          onClose={handleCloseCropper}
          maxOutputSize={maxOutputSize}
        />
      )}
      {childImageToEdit && (
        <ImageCropper
          image={childImageToEdit}
          aspectRatioType={childAspectRatioType}
          onCropComplete={handleChildCropComplete}
          onClose={handleChildCloseCropper}
          maxOutputSize={childMaxOutputSize}
        />
      )}
    </>
  );
}
