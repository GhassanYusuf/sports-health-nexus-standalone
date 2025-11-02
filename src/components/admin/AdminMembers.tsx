import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Check, X, Trash2, Calendar, Edit, Mail, Phone, User, Users } from "lucide-react";
import { AdminWalkInRegistration } from "./AdminWalkInRegistration";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput } from "@/components/PhoneInput";
import countries from "world-countries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

interface AdminMembersProps {
  clubId: string;
}

export function AdminMembers({ clubId }: AdminMembersProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [searchEmailPhone, setSearchEmailPhone] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showWalkInRegistration, setShowWalkInRegistration] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "not_active" | "former">("active");
  
  // Enrollment dialog
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  
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
  
  // Form states for creating new member
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberCountryCode, setNewMemberCountryCode] = useState("+1");
  const [newMemberGender, setNewMemberGender] = useState("");
  const [newMemberDOB, setNewMemberDOB] = useState("");
  const [newMemberNationality, setNewMemberNationality] = useState("");
  
  // Edit form states
  const [editRank, setEditRank] = useState("");
  const [editAchievements, setEditAchievements] = useState("0");

  const countryOptions = countries
    .filter((country) => country.cca2 !== "IL") // Exclude Israel
    .map((country) => ({
      label: `${country.flag} ${country.name.common}`,
      value: country.cca2,
      callingCode: country.idd.root + (country.idd.suffixes?.[0] || ""),
    }));

  // Helper functions for member card display
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
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
    return "Pisces";
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
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    
    return { months, days };
  };

  const getCountryFlag = (countryCode: string) => {
    const country = countries.find((c) => c.cca2 === countryCode);
    return country?.flag || "";
  };

  useEffect(() => {
    checkAdminRole();
    cleanupDuplicateOwnerMember();
    fetchMembers();
    fetchRequests();
  }, [clubId]);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

  setIsSuperAdmin(roles?.some(r => r.role === "super_admin") ?? false);
  };

  const cleanupDuplicateOwnerMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.functions.invoke("cleanup-duplicate-member", {
        body: { scope: "self-beginner" }
      });
    } catch (e) {
      console.error("cleanup duplicate failed", e);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_members")
      .select(`
        *,
        package_enrollments(
          id,
          is_active,
          package_id
        )
      `)
      .eq("club_id", clubId)
      .order("joined_date", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch profile/child data separately for each member
    const membersWithProfiles = await Promise.all(
      (data || []).map(async (member) => {
        // For adult members (user_id is set)
        if (member.user_id && !member.child_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url, phone, country_code, email, date_of_birth, gender, nationality")
            .eq("user_id", member.user_id)
            .maybeSingle();
          
          return {
            ...member,
            profiles: profile,
          };
        }
        
        // For child members (child_id is set)
        if (member.child_id && !member.user_id) {
          const { data: child } = await supabase
            .from("children")
            .select("name, avatar_url, date_of_birth, gender, nationality, parent_user_id")
            .eq("id", member.child_id)
            .maybeSingle();
          
          if (!child) return { ...member, profiles: null };
          
          // Fetch parent's profile for contact info
          const { data: parentProfile } = await supabase
            .from("profiles")
            .select("name, phone, country_code, email")
            .eq("user_id", child.parent_user_id)
            .maybeSingle();
          
          // Transform child data to match profiles structure
          return {
            ...member,
            profiles: {
              name: child.name,
              parentName: parentProfile?.name,
              avatar_url: child.avatar_url,
              date_of_birth: child.date_of_birth,
              gender: child.gender,
              nationality: child.nationality,
              phone: parentProfile?.phone,
              country_code: parentProfile?.country_code,
              email: parentProfile?.email,
            },
          };
        }
        
        return { ...member, profiles: null };
      })
    );

    setMembers(membersWithProfiles);
    setLoading(false);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("membership_requests")
      .select("*")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Fetch profile data separately for each request
    const requestsWithProfiles = await Promise.all(
      (data || []).map(async (request) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url, phone")
          .eq("user_id", request.user_id)
          .single();
        
        return {
          ...request,
          profiles: profile,
        };
      })
    );

    setRequests(requestsWithProfiles);
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update request status
    const { error: updateError } = await supabase
      .from("membership_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        notes: reviewNotes,
      })
      .eq("id", requestId);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
      return;
    }

    // Create club member
    const { error: memberError } = await supabase
      .from("club_members")
      .insert([{
        club_id: clubId,
        user_id: userId,
        rank: "Member",
        name: "", // Will be populated from profile
        joined_date: new Date().toISOString().split('T')[0],
      }]);

    if (memberError) {
      toast({ title: "Error", description: memberError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Membership request approved" });
    setReviewNotes("");
    fetchRequests();
    fetchMembers();
  };

  const handleRejectRequest = async (requestId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("membership_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        notes: reviewNotes,
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Membership request rejected" });
    setReviewNotes("");
    fetchRequests();
  };

  const handleSearchUser = async () => {
    if (!searchEmailPhone.trim()) {
      toast({ title: "Error", description: "Please enter an email or phone number", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    try {
      // Search for user by email or phone
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .or(`email.eq.${searchEmailPhone},phone.eq.${searchEmailPhone}`)
        .limit(1);

      if (profileError) throw profileError;

      if (!profiles || profiles.length === 0) {
        toast({ title: "Not Found", description: "No user found with that email or phone number", variant: "destructive" });
        setSearchResults([]);
        return;
      }

      const profile = profiles[0];

      // Fetch children associated with this user
      const { data: children, error: childrenError } = await supabase
        .from("children")
        .select("*")
        .eq("parent_user_id", profile.user_id);

      if (childrenError) throw childrenError;

      // Combine user and children into search results
      const results = [
        { ...profile, type: "user", display_name: profile.name },
        ...(children || []).map(child => ({ 
          ...child, 
          type: "child", 
          display_name: child.name,
          parent_user_id: profile.user_id 
        }))
      ];

      setSearchResults(results);
      setSelectedMembers(new Set());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleMemberSelection = (id: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMembers(newSelection);
  };

  const handleAddMember = async () => {
    if (selectedMembers.size === 0) {
      toast({ title: "Error", description: "Please select at least one member to add", variant: "destructive" });
      return;
    }

    try {
      const membersToAdd = Array.from(selectedMembers).map(id => {
        const result = searchResults.find(r => (r.type === "user" ? r.user_id : r.id) === id);
        if (!result) return null;

        // For parents: set user_id, child_id stays null
        // For children: set child_id, user_id stays null
        return {
          club_id: clubId,
          user_id: result.type === "user" ? result.user_id : null,
          child_id: result.type === "child" ? result.id : null,
          name: result.display_name,
          rank: "Member",
          avatar_url: result.avatar_url,
          joined_date: new Date().toISOString().split('T')[0],
        };
      }).filter(Boolean);

      const { error } = await supabase
        .from("club_members")
        .insert(membersToAdd);

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `${selectedMembers.size} member(s) added successfully` 
      });
      
      setShowAddDialog(false);
      setSearchEmailPhone("");
      setSearchResults([]);
      setSelectedMembers(new Set());
      fetchMembers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberEmail || !newMemberPassword || !newMemberName || !newMemberPhone) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newMemberEmail,
        password: newMemberPassword,
        options: {
          data: {
            name: newMemberName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{
          user_id: authData.user.id,
          name: newMemberName,
          phone: newMemberPhone,
          country_code: newMemberCountryCode,
          gender: newMemberGender,
          date_of_birth: newMemberDOB,
          nationality: newMemberNationality,
        }]);

      if (profileError) throw profileError;

      // Create club member
      const { error: memberError } = await supabase
        .from("club_members")
        .insert([{
          club_id: clubId,
          user_id: authData.user.id,
          name: newMemberName,
          rank: "Member",
          joined_date: new Date().toISOString().split('T')[0],
        }]);

      if (memberError) throw memberError;

      toast({ title: "Success", description: "Member created successfully" });
      
      // Reset form
      setShowCreateDialog(false);
      setNewMemberEmail("");
      setNewMemberPassword("");
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberGender("");
      setNewMemberDOB("");
      setNewMemberNationality("");
      
      fetchMembers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;

    const { error } = await supabase
      .from("club_members")
      .update({
        rank: editRank,
        achievements: parseInt(editAchievements) || 0,
      })
      .eq("id", editingMember.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Member updated successfully" });
    setShowEditDialog(false);
    setEditingMember(null);
    fetchMembers();
  };

  const openEditDialog = (member: any) => {
    setEditingMember(member);
    setEditRank(member.rank || "Member");
    setEditAchievements(String(member.achievements || 0));
    setShowEditDialog(true);
  };

  const openEnrollDialog = async (member: any) => {
    setEditingMember(member);
    
    // Calculate member age
    let memberAge = 0;
    let memberGender = "";
    
    if (member.profiles?.date_of_birth) {
      const birthDate = new Date(member.profiles.date_of_birth);
      const today = new Date();
      memberAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        memberAge--;
      }
      memberGender = member.profiles.gender || "";
    }

    // Fetch packages for this club
    const { data: packages, error } = await supabase
      .from("club_packages")
      .select("*")
      .eq("club_id", clubId)
      .order("price", { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Filter packages based on age and gender
    const filteredPackages = (packages || []).filter((pkg) => {
      // Check age restrictions
      if (pkg.age_min && memberAge < pkg.age_min) return false;
      if (pkg.age_max && memberAge > pkg.age_max) return false;
      
      // Check gender restrictions
      if (pkg.gender_restriction && pkg.gender_restriction !== "mixed") {
        if (memberGender.toLowerCase() !== pkg.gender_restriction.toLowerCase()) {
          return false;
        }
      }
      
      return true;
    });

    setAvailablePackages(filteredPackages);
    setShowEnrollDialog(true);
  };

  const handleEnrollPackage = async () => {
    if (!selectedPackageId || !editingMember) {
      toast({ 
        title: "Error", 
        description: "Please select a package",
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      // Insert package enrollment
      const { error } = await supabase
        .from("package_enrollments")
        .insert({
          member_id: editingMember.id,
          package_id: selectedPackageId,
          is_active: true,
        });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: "Member enrolled in package successfully" 
      });

      setShowEnrollDialog(false);
      setSelectedPackageId(null);
      fetchMembers();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!isSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only super admins can delete members",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Member deleted successfully" });
    fetchMembers();
  };

  const handleLeaveClub = async () => {
    if (!editingMember) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("member-leave-club", {
        body: {
          memberId: editingMember.id,
          leaveReason: leaveReason.trim() || null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Member Left Club",
        description: `Member has left successfully. ${data.skills_acquired?.length || 0} skills recorded.`,
      });

      setShowLeaveDialog(false);
      setEditingMember(null);
      setLeaveReason("");
      fetchMembers();
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

  const openGraduateDialog = (member: any) => {
    if (!member.child_id) {
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
    setGraduatePhone(member.profiles?.phone || "");
    setGraduateCountryCode(member.profiles?.country_code || "+1");
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
          child_id: graduatingChild.child_id,
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
        description: `${graduatingChild.profiles?.name} is now an independent adult member. ${data.transferred_memberships || 0} memberships transferred.`,
      });

      setShowGraduateDialog(false);
      setGraduatingChild(null);
      fetchMembers();
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
    if (!member.user_id || member.child_id) {
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
        .or(`email.eq.${degradateParentSearch},phone.eq.${degradateParentSearch}`)
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
        description: `${degradatingMember.profiles?.name} is now managed as a child by ${selectedParent.name}. ${data.transferred_memberships || 0} memberships transferred.`,
      });

      setShowDegradateDialog(false);
      setDegradatingMember(null);
      setSelectedParent(null);
      fetchMembers();
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

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.rank?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check if member has active package enrollment
    const hasActiveEnrollment = m.package_enrollments?.some((enrollment: any) => enrollment.is_active);
    
    const matchesStatus =
      (memberStatusFilter === "all" && m.is_active) || // All = active members only (excluding former)
      (memberStatusFilter === "active" && m.is_active && hasActiveEnrollment) ||
      (memberStatusFilter === "not_active" && m.is_active && !hasActiveEnrollment) ||
      (memberStatusFilter === "former" && m.is_active === false);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">Members Management</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Existing User
          </Button>
          <Button variant="default" onClick={() => setShowWalkInRegistration(true)}>
            <Users className="mr-2 h-4 w-4" />
            Walk-In Registration
          </Button>
        </div>
      </div>

      <AdminWalkInRegistration
        clubId={clubId}
        open={showWalkInRegistration}
        onOpenChange={setShowWalkInRegistration}
        onSuccess={() => {
          setShowWalkInRegistration(false);
          fetchMembers();
          toast({ title: "Success!", description: "Registration completed and receipt sent" });
        }}
      />

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members">
            Current Members ({filteredMembers.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Pending Requests ({requests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or rank..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Status:</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={memberStatusFilter === "active" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMemberStatusFilter("active")}
                    >
                      Active ({members.filter(m => m.is_active && m.package_enrollments?.some((e: any) => e.is_active)).length})
                    </Button>
                    <Button
                      variant={memberStatusFilter === "not_active" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMemberStatusFilter("not_active")}
                    >
                      Not Active ({members.filter(m => m.is_active && !m.package_enrollments?.some((e: any) => e.is_active)).length})
                    </Button>
                    <Button
                      variant={memberStatusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMemberStatusFilter("all")}
                    >
                      All ({members.filter(m => m.is_active).length})
                    </Button>
                    <Button
                      variant={memberStatusFilter === "former" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMemberStatusFilter("former")}
                    >
                      Former ({members.filter(m => m.is_active === false).length})
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {filteredMembers.map((member) => (
                    <Card 
                      key={member.id} 
                      className="overflow-hidden hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 group"
                    >
                      <CardContent className="p-0">
                        {/* Header with Avatar */}
                        <div className={`p-6 pb-4 ${
                          member.profiles?.gender === 'male'
                            ? 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent'
                            : 'bg-gradient-to-br from-pink-500/10 via-pink-400/5 to-transparent'
                        }`}>
                          <div className="flex items-start gap-4">
                            <Avatar className={`h-20 w-20 border-4 border-background shadow-lg ring-2 transition-all ${
                              member.profiles?.gender === 'male'
                                ? 'ring-blue-400/30 group-hover:ring-blue-500/50'
                                : 'ring-pink-400/30 group-hover:ring-pink-500/50'
                            }`}>
                              <AvatarImage src={member.profiles?.avatar_url} />
                              <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                                {member.profiles?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xl truncate">
                                {member.profiles?.name}
                              </div>
                              {member.profiles?.parentName && (
                                <div className="text-sm text-muted-foreground font-medium mt-1">
                                  Parent: {member.profiles.parentName}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="default" className="font-semibold">
                                  {member.rank}
                                </Badge>
                                <Badge variant="secondary" className="font-medium">
                                  {member.achievements || 0} 🏆
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        {(member.profiles?.phone || member.profiles?.email) && (
                          <div className="px-6 py-3 bg-muted/30 border-y space-y-2">
                            {member.profiles?.phone && (
                              <a 
                                href={`/go?u=${encodeURIComponent(`https://wa.me/${member.profiles.country_code?.replace(/\\D/g, '')}${member.profiles.phone?.replace(/\\D/g, '')}`)}`}
                                target="_blank"
                                rel="noopener"
                                className="flex items-center gap-2 text-sm no-underline"
                              >
                                <Phone className="h-4 w-4 text-primary" />
                                <span className="font-medium text-foreground">
                                  {member.profiles.country_code} {member.profiles.phone}
                                </span>
                              </a>
                            )}
                            {member.profiles?.email && (
                              <a 
                                href={`mailto:${member.profiles.email}`}
                                className="flex items-center gap-2 text-sm no-underline"
                              >
                                <Mail className="h-4 w-4 text-primary" />
                                <span className="font-medium text-foreground">{member.profiles.email}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Member Details */}
                        {member.profiles?.date_of_birth && (
                          <div className="px-6 py-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Gender
                                </div>
                                <div className="font-semibold capitalize">
                                  {member.profiles?.gender || "N/A"}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Age
                                </div>
                                <div className="font-semibold">
                                  {calculateAge(member.profiles.date_of_birth)} years
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Nationality
                                </div>
                                <div className="font-semibold text-lg">
                                  {getCountryFlag(member.profiles?.nationality || "")} {member.profiles?.nationality || "N/A"}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Horoscope
                                </div>
                                <div className="font-semibold">
                                  ♈ {getHoroscope(member.profiles.date_of_birth)}
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-medium">Next Birthday</span>
                                <span className="font-semibold text-primary">
                                  {(() => {
                                    const { months, days } = getNextBirthdayCountdown(member.profiles.date_of_birth);
                                    return `${months}m ${days}d`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-medium">Member Since</span>
                                <span className="font-semibold">
                                  {new Date(member.joined_date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="px-6 py-4 bg-muted/20 flex gap-2 flex-wrap">
                          {member.is_active !== false ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => openEditDialog(member)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              
                              {member.child_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => openGraduateDialog(member)}
                                >
                                  Graduate to Adult
                                </Button>
                              )}
                              
                              {member.user_id && !member.child_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => openDegradateDialog(member)}
                                >
                                  Move to Child
                                </Button>
                              )}
                              
                              {isSuperAdmin && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteMember(member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 text-center py-2 text-sm text-muted-foreground">
                              Left on {member.left_date ? new Date(member.left_date).toLocaleDateString() : 'N/A'}
                              {member.leave_reason && (
                                <div className="text-xs mt-1">Reason: {member.leave_reason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending membership requests
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.profiles?.avatar_url} />
                          <AvatarFallback>
                            {request.profiles?.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">
                            {request.profiles?.name}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Requested on{" "}
                            {new Date(request.requested_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge>Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Add notes about this request..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          handleApproveRequest(request.id, request.user_id)
                        }
                        className="flex-1"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleRejectRequest(request.id)}
                        className="flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Existing User</DialogTitle>
            <DialogDescription>
              Search for a user by email or phone number to add them and their children as members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter email or phone number..."
                value={searchEmailPhone}
                onChange={(e) => setSearchEmailPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
                className="flex-1"
              />
              <Button onClick={handleSearchUser} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select members to add:</Label>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map((result) => {
                    const id = result.type === "user" ? result.user_id : result.id;
                    const isSelected = selectedMembers.has(id);
                    
                    return (
                      <Card
                        key={id}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => toggleMemberSelection(id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                              isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <Avatar>
                              <AvatarImage src={result.avatar_url} />
                              <AvatarFallback>{result.display_name?.charAt(0) || "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{result.display_name}</span>
                                <Badge variant={result.type === "user" ? "default" : "secondary"}>
                                  {result.type === "user" ? "Parent" : "Child"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.type === "user" 
                                  ? result.phone 
                                  : `Born: ${result.date_of_birth || "N/A"}`
                                }
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              setSearchEmailPhone("");
              setSearchResults([]);
              setSelectedMembers(new Set());
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={selectedMembers.size === 0}>
              Add {selectedMembers.size > 0 ? `${selectedMembers.size} ` : ""}Member(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Member</DialogTitle>
            <DialogDescription>
              Create a new user account and add them as a member to this club.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="member@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <PhoneInput
                    phoneNumber={newMemberPhone}
                    countryCode={newMemberCountryCode}
                    onPhoneNumberChange={setNewMemberPhone}
                    onCountryCodeChange={setNewMemberCountryCode}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={newMemberGender} onValueChange={setNewMemberGender}>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={newMemberDOB}
                      onChange={(e) => setNewMemberDOB(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Select value={newMemberNationality} onValueChange={setNewMemberNationality}>
                    <SelectTrigger id="nationality">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMember}>
              Create Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <DialogTitle className="text-2xl font-bold">Edit Member Profile</DialogTitle>
            <DialogDescription className="text-base">
              Update details for {editingMember?.profiles?.name || editingMember?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 py-6 space-y-6 overflow-y-auto flex-1">
            {/* Edit Fields Card */}
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  Member Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-0">
                <div className="space-y-2.5">
                  <Label htmlFor="rank" className="text-sm font-semibold flex items-center gap-2">
                    🏅 Rank Level
                  </Label>
                  <Select value={editRank} onValueChange={setEditRank}>
                    <SelectTrigger id="rank" className="h-12 text-base">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="Beginner" className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span>🥉</span>
                          <span>Beginner</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Member" className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span>👤</span>
                          <span>Member</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Advanced" className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span>⭐</span>
                          <span>Advanced</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Elite" className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span>💎</span>
                          <span>Elite</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Champion" className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span>🏆</span>
                          <span>Champion</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="achievements" className="text-sm font-semibold flex items-center gap-2">
                    🏆 Achievements Count
                  </Label>
                  <Input
                    id="achievements"
                    type="number"
                    min="0"
                    value={editAchievements}
                    onChange={(e) => setEditAchievements(e.target.value)}
                    className="h-12 text-base"
                    placeholder="Number of achievements earned"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex gap-3 w-full flex-wrap sm:flex-nowrap">
              <Button 
                variant="outline" 
                size="lg"
                className="h-12 text-base font-semibold" 
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="secondary"
                size="lg"
                className="flex-1 h-12 text-base font-semibold"
                onClick={() => {
                  setShowEditDialog(false);
                  openEnrollDialog(editingMember);
                }}
                disabled={!editingMember?.is_active}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Enroll
              </Button>
              <Button 
                variant="destructive"
                size="lg"
                className="flex-1 h-12 text-base font-semibold"
                onClick={() => setShowLeaveDialog(true)}
                disabled={!editingMember?.is_active}
              >
                <X className="mr-2 h-5 w-5" />
                Leave Club
              </Button>
              <Button 
                size="lg"
                className="flex-1 h-12 text-base font-semibold" 
                onClick={handleEditMember}
              >
                <Check className="mr-2 h-5 w-5" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Member Leave</DialogTitle>
            <DialogDescription>
              Are you sure you want to process {editingMember?.profiles?.name || editingMember?.name}'s departure from the club? 
              This will create a permanent history record with all acquired skills.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave-reason">Leave Reason (Optional)</Label>
              <Textarea
                id="leave-reason"
                placeholder="Enter reason for leaving the club..."
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Member status will be set to inactive</li>
                <li>All package enrollments will be deactivated</li>
                <li>Membership history will be recorded with join/leave dates</li>
                <li>Skills gained from activities will be tracked</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLeaveDialog(false);
              setLeaveReason("");
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleLeaveClub}
              disabled={loading}
            >
              {loading ? "Processing..." : "Confirm Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Graduate Child Dialog */}
      <Dialog open={showGraduateDialog} onOpenChange={setShowGraduateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Graduate Child to Adult Member</DialogTitle>
            <DialogDescription>
              {graduatingChild?.profiles?.name} will become an independent adult member with their own account.
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
              {degradatingMember?.profiles?.name} will be managed as a child by a parent member.
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
                        {selectedParent.email || selectedParent.phone}
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

      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-2xl font-bold">Enroll in Package</DialogTitle>
            <DialogDescription className="text-base">
              Select the perfect package for {editingMember?.profiles?.name || editingMember?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
            {editingMember?.profiles?.date_of_birth && (
              <Card className="overflow-hidden border-2 animate-fade-in">
                <div className={`bg-gradient-to-br p-4 ${
                  editingMember.profiles.gender === 'male'
                    ? 'from-blue-500/10 via-blue-400/5 to-transparent'
                    : 'from-pink-500/10 via-pink-400/5 to-transparent'
                }`}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border-4 border-background shadow-lg">
                      <AvatarImage src={editingMember.profiles.avatar_url} />
                      <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                        {editingMember.profiles.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg mb-1 truncate">{editingMember.profiles.name}</h3>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{calculateAge(editingMember.profiles.date_of_birth)} years old</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-semibold capitalize">{editingMember.profiles.gender}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {availablePackages.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UserPlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No Packages Available</h3>
                  <p className="text-muted-foreground">
                    No packages match the age and gender criteria for this member.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Available Packages</h3>
                  <Badge variant="secondary" className="text-sm">
                    {availablePackages.length} package{availablePackages.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {availablePackages.map((pkg, index) => (
                    <Card
                      key={pkg.id}
                      className={`cursor-pointer transition-all duration-300 hover:shadow-lg animate-fade-in border-2 ${
                        selectedPackageId === pkg.id
                          ? "border-primary bg-primary/5 shadow-md"
                          : "hover:border-primary/50"
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => setSelectedPackageId(pkg.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-7 h-7 border-2 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            selectedPackageId === pkg.id 
                              ? "bg-primary border-primary scale-110" 
                              : "border-muted-foreground"
                          }`}>
                            {selectedPackageId === pkg.id && (
                              <Check className="h-4 w-4 text-primary-foreground animate-scale-in" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-lg">{pkg.name}</h3>
                              {pkg.is_popular && (
                                <Badge className="bg-gradient-to-r from-primary to-primary/70">
                                  ⭐ Popular
                                </Badge>
                              )}
                            </div>
                            
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {pkg.description}
                              </p>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Price
                                </div>
                                <div className="font-bold text-lg text-primary">
                                  ${pkg.price}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                  Duration
                                </div>
                                <div className="font-semibold">
                                  {pkg.duration_months} months
                                </div>
                              </div>
                              {pkg.age_min && pkg.age_max && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                    Age Range
                                  </div>
                                  <div className="font-semibold">
                                    {pkg.age_min}-{pkg.age_max} yrs
                                  </div>
                                </div>
                              )}
                              {pkg.gender_restriction && pkg.gender_restriction !== "mixed" && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                    Gender
                                  </div>
                                  <div className="font-semibold capitalize">
                                    {pkg.gender_restriction}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-row gap-3">
            <Button 
              variant="outline"
              size="lg"
              onClick={() => {
                setShowEnrollDialog(false);
                setSelectedPackageId(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              size="lg"
              onClick={handleEnrollPackage}
              disabled={!selectedPackageId || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Enrolling...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Enrollment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
