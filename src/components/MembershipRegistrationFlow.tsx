import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, User, Users, Calendar, DollarSign, AlertCircle, Upload, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "./PhoneInput";
import { SearchableSelect } from "./SearchableSelect";
import { AddChildDialog } from "./AddChildDialog";
import { z } from "zod";
import countries from "world-countries";

interface Package {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  activity_type: string;
  age_min?: number;
  age_max?: number;
  gender_restriction?: string;
}

interface Registrant {
  id: string;
  type: 'self' | 'child';
  packageId: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  bloodType: string;
  avatarUrl?: string;
  // Additional fields for 'self' type (account holder)
  email?: string;
  phone?: string;
  countryCode?: string;
  address?: string;
}

interface PreSelectedMember {
  type: 'self' | 'child';
  name: string;
  avatarUrl?: string;
  childId?: string;
  childData?: any;
}

interface Props {
  clubId: string;
  packages: Package[];
  currency?: string;
  initialPackageId?: string;
  preSelectedMembers?: PreSelectedMember[];
  hasChildren?: boolean;
  existingUserMode?: boolean;
  userProfile?: any;
  existingChildren?: any[];
  clubData?: {
    id: string;
    name: string;
    currency: string;
    enrollment_fee: number;
    vat_percentage: number;
    vat_registration_number: string | null;
  };
  onComplete?: () => void;
  onCancel?: () => void;
}

const registrantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"]),
  nationality: z.string().min(2, "Nationality is required"),
  bloodType: z.string().min(1, "Blood type is required"),
  packageId: z.string().min(1, "Package selection is required")
});

const selfRegistrantSchema = registrantSchema.extend({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  countryCode: z.string().min(1, "Country code is required"),
  address: z.string().max(200).optional()
});

const guardianSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  countryCode: z.string().min(1, "Country code is required"),
  address: z.string().max(200).optional(),
  nationality: z.string().min(2, "Nationality is required")
});

export const MembershipRegistrationFlow: React.FC<Props> = ({
  clubId,
  packages,
  currency = 'USD',
  initialPackageId,
  preSelectedMembers,
  hasChildren,
  existingUserMode = false,
  userProfile,
  existingChildren,
  clubData,
  onComplete,
  onCancel
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'select-type' | 'package-selection' | 'payment-review' | 'details' | 'review'>(
    preSelectedMembers && preSelectedMembers.length > 0 ? 'details' : 'select-type'
  );
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [registrationType, setRegistrationType] = useState<'self' | 'self-and-kids' | 'kids-only' | null>(null);
  const [guardianInfo, setGuardianInfo] = useState({
    name: '',
    email: '',
    phone: '',
    countryCode: '+1',
    address: '',
    nationality: ''
  });
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState<string>('');
  const [firstTimers, setFirstTimers] = useState<string[]>([]); // IDs of first-time registrants
  const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);
  const [payLater, setPayLater] = useState(false);
  const [packageActivities, setPackageActivities] = useState<Record<string, any[]>>({});

  // Initialize with pre-selected members or auto-select based on hasChildren
  useEffect(() => {
    if (existingUserMode && registrants.length === 0 && userProfile) {
      // For existing users, auto-populate with profile data
      if (hasChildren === false) {
        // No children - auto-select "self" and pre-populate
        setRegistrationType('self');
        const selfRegistrant: Registrant = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'self',
          packageId: initialPackageId || '',
          name: userProfile.name,
          dateOfBirth: userProfile.date_of_birth,
          gender: userProfile.gender,
          nationality: userProfile.nationality,
          bloodType: userProfile.blood_type || '',
          avatarUrl: userProfile.avatar_url,
          email: userProfile.email,
          phone: userProfile.phone,
          countryCode: userProfile.country_code,
          address: userProfile.address
        };
        setRegistrants([selfRegistrant]);
        setStep('select-type'); // Still show selection so they can pick packages
      }
      // If they have children, show the selection screen
    } else if (preSelectedMembers && preSelectedMembers.length > 0 && registrants.length === 0) {
      const hasSelf = preSelectedMembers.some(m => m.type === 'self');
      const hasKids = preSelectedMembers.some(m => m.type === 'child');
      
      if (hasSelf && hasKids) {
        setRegistrationType('self-and-kids');
      } else if (hasSelf) {
        setRegistrationType('self');
      } else {
        setRegistrationType('kids-only');
      }

      const newRegistrants: Registrant[] = preSelectedMembers.map(member => ({
        id: Math.random().toString(36).substr(2, 9),
        type: member.type,
        packageId: initialPackageId || '',
        name: member.name,
        dateOfBirth: member.childData?.date_of_birth || '',
        gender: member.childData?.gender || 'male',
        nationality: member.childData?.nationality || '',
        bloodType: member.childData?.blood_type || '',
        avatarUrl: member.avatarUrl,
        ...(member.type === 'self' && {
          email: '',
          phone: '',
          countryCode: '+1',
          address: ''
        })
      }));

      setRegistrants(newRegistrants);
    } else if (hasChildren === false && registrants.length === 0 && !existingUserMode) {
      // Auto-select "self" registration and skip to details (for non-existing user mode)
      setRegistrationType('self');
      addRegistrant('self');
      setStep('details');
    }
  }, [preSelectedMembers, hasChildren, existingUserMode, userProfile, existingChildren]);

  // Fetch package activities with schedule and instructor info
  useEffect(() => {
    const fetchPackageActivities = async () => {
      try {
        const packageIds = packages.map(p => p.id);
        
        const { data: activities, error } = await supabase
          .from('package_activities')
          .select(`
            package_id,
            activity_id,
            instructor_id,
            activities (
              id,
              title,
              description,
              activity_schedules (
                day_of_week,
                start_time,
                end_time
              )
            ),
            club_instructors (
              id,
              name,
              specialty,
              image_url
            )
          `)
          .in('package_id', packageIds);
        
        if (error) throw error;
        
        // Group activities by package_id
        const grouped: Record<string, any[]> = {};
        activities?.forEach((item: any) => {
          if (!grouped[item.package_id]) {
            grouped[item.package_id] = [];
          }
          grouped[item.package_id].push(item);
        });
        
        setPackageActivities(grouped);
      } catch (error) {
        console.error('Error fetching package activities:', error);
      }
    };
    
    if (packages.length > 0) {
      fetchPackageActivities();
    }
  }, [packages]);

  // Country options for nationality select
  const nationalityOptions = countries
    .filter((c) => c.cca2 !== "IL")
    .map((c) => ({
      value: c.name.common,
      label: c.name.common,
      icon: c.flag,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const formatCurrency = (amount: number) => {
    const useCurrency = clubData?.currency || currency;
    const hasDecimals = amount % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: useCurrency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(amount);
  };

  const checkFirstTimeEnrollment = async (registrant: Registrant): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      if (registrant.type === 'self') {
        // Check if this user has ever been a member of this club
        const { data } = await supabase
          .from('club_members')
          .select('id')
          .eq('club_id', clubId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        return data === null; // True if no record found (first-timer)
      } else {
        // For children, check if they exist in club_members
        if (existingUserMode && existingChildren) {
          const existingChild = existingChildren.find(c => 
            c.name === registrant.name && 
            c.date_of_birth === registrant.dateOfBirth
          );
          
          if (existingChild) {
            const { data } = await supabase
              .from('club_members')
              .select('id')
              .eq('club_id', clubId)
              .eq('child_id', existingChild.id)
              .maybeSingle();
            
            return data === null; // True if no record found (first-timer)
          }
        }
        
        // If we can't determine (new user mode), assume first-timer
        return true;
      }
    } catch (error) {
      console.error('Error checking enrollment status:', error);
      return true; // Default to first-timer if error occurs
    }
  };

  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const checkEligibility = (registrant: Registrant): { eligible: boolean; reason?: string } => {
    const pkg = packages.find(p => p.id === registrant.packageId);
    if (!pkg) return { eligible: true };

    // Check age restrictions
    if (registrant.dateOfBirth) {
      const age = calculateAge(registrant.dateOfBirth);
      if (age !== null) {
        if (pkg.age_min && age < pkg.age_min) {
          return { eligible: false, reason: `Minimum age: ${pkg.age_min} years` };
        }
        if (pkg.age_max && age > pkg.age_max) {
          return { eligible: false, reason: `Maximum age: ${pkg.age_max} years` };
        }
      }
    }

    // Check gender restrictions
    if (pkg.gender_restriction && pkg.gender_restriction !== 'mixed' && registrant.gender) {
      if (pkg.gender_restriction !== registrant.gender) {
        return { eligible: false, reason: `This package is for ${pkg.gender_restriction}s only` };
      }
    }

    return { eligible: true };
  };

  const calculateTotal = () => {
    // Calculate package total
    const packageTotal = registrants.reduce((sum, reg) => {
      const pkg = packages.find(p => p.id === reg.packageId);
      return sum + (pkg?.price || 0);
    }, 0);
    
    // Calculate enrollment fee (only for first-timers)
    const enrollmentFeeTotal = firstTimers.length * (clubData?.enrollment_fee || 0);
    
    // Calculate subtotal
    const subtotal = packageTotal + enrollmentFeeTotal;
    
    // Calculate VAT if club has VAT registration
    const hasVatNumber = clubData?.vat_registration_number && 
                         clubData.vat_registration_number.trim() !== '';
    const vatPercentage = hasVatNumber ? (clubData?.vat_percentage || 0) : 0;
    const vatAmount = hasVatNumber ? subtotal * (vatPercentage / 100) : 0;
    
    // Return grand total
    return subtotal + vatAmount;
  };

  const addRegistrant = (type: 'self' | 'child') => {
    const newRegistrant: Registrant = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      packageId: initialPackageId || '',
      name: '',
      dateOfBirth: '',
      gender: 'male',
      nationality: '',
      bloodType: '',
      // Add account holder fields for self type
      ...(type === 'self' && {
        email: '',
        phone: '',
        countryCode: '+1',
        address: ''
      })
    };
    setRegistrants([...registrants, newRegistrant]);
  };

  const removeRegistrant = (id: string) => {
    setRegistrants(registrants.filter(r => r.id !== id));
  };

  const updateRegistrant = (id: string, field: keyof Registrant, value: any) => {
    setRegistrants(registrants.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const validateStep = () => {
    if (step === 'select-type') {
      if (registrants.length === 0) {
        toast({
          title: "Selection required",
          description: "Please add at least one person to register",
          variant: "destructive"
        });
        return false;
      }
      return true;
    }

    if (step === 'package-selection') {
      // Check that all registrants have selected a package
      const missingPackages = registrants.filter(r => !r.packageId);
      if (missingPackages.length > 0) {
        toast({
          title: "Package selection required",
          description: "Please select a package for all registrants",
          variant: "destructive"
        });
        return false;
      }
      
      // Validate eligibility
      for (const reg of registrants) {
        const eligibility = checkEligibility(reg);
        if (!eligibility.eligible) {
          toast({
            title: "Eligibility issue",
            description: `${reg.name} is not eligible for the selected package. ${eligibility.reason}`,
            variant: "destructive"
          });
          return false;
        }
      }
      return true;
    }

    if (step === 'payment-review') {
      if (!payLater && !paymentScreenshotUrl) {
        toast({
          title: "Payment proof required",
          description: "Please upload a payment screenshot or select 'Pay Later'",
          variant: "destructive"
        });
        return false;
      }
      return true;
    }

    if (step === 'details') {
      // Validate guardian info only for kids-only registration
      if (registrationType === 'kids-only') {
        try {
          guardianSchema.parse(guardianInfo);
        } catch (error) {
          if (error instanceof z.ZodError) {
            toast({
              title: "Invalid guardian information",
              description: error.errors[0].message,
              variant: "destructive"
            });
            return false;
          }
        }
      }

      // Validate each registrant
      for (const reg of registrants) {
        try {
          // Use extended schema for self type
          if (reg.type === 'self') {
            selfRegistrantSchema.parse(reg);
          } else {
            registrantSchema.parse(reg);
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            toast({
              title: `Invalid information for ${reg.name || 'registrant'}`,
              description: error.errors[0].message,
              variant: "destructive"
            });
            return false;
          }
        }

        // Age validation for package
        const pkg = packages.find(p => p.id === reg.packageId);
        if (pkg && reg.dateOfBirth) {
          const age = Math.floor((new Date().getTime() - new Date(reg.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (pkg.age_min && age < pkg.age_min) {
            toast({
              title: "Age restriction",
              description: `${reg.name || 'Registrant'} is too young for ${pkg.name} (minimum age: ${pkg.age_min})`,
              variant: "destructive"
            });
            return false;
          }
          if (pkg.age_max && age > pkg.age_max) {
            toast({
              title: "Age restriction",
              description: `${reg.name || 'Registrant'} is too old for ${pkg.name} (maximum age: ${pkg.age_max})`,
              variant: "destructive"
            });
            return false;
          }
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (existingUserMode) {
      // Flow for existing users: select-type -> package-selection -> payment-review
      if (step === 'select-type') {
        setStep('package-selection');
      } else if (step === 'package-selection') {
        // Before moving to payment review, check who is a first-timer
        const firstTimerIds: string[] = [];
        for (const reg of registrants) {
          const isFirstTimer = await checkFirstTimeEnrollment(reg);
          if (isFirstTimer) {
            firstTimerIds.push(reg.id);
          }
        }
        setFirstTimers(firstTimerIds);
        setStep('payment-review');
      }
    } else {
      // Flow for new users: select-type -> details -> review
      if (step === 'select-type') {
        setStep('details');
      } else if (step === 'details') {
        setStep('review');
      }
    }
  };

  const handlePaymentScreenshotUpload = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to upload payment proof",
          variant: "destructive"
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `payment-${clubId}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (uploadError) {
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive"
        });
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      setPaymentScreenshotUrl(publicUrl);
      setPaymentScreenshot(file);
      
      toast({
        title: "Upload successful",
        description: "Payment screenshot uploaded successfully"
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleChildAdded = (childData: {
    name: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    bloodType?: string;
    avatarUrl?: string;
  }) => {
    const newRegistrant: Registrant = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'child',
      packageId: initialPackageId || '',
      name: childData.name,
      dateOfBirth: childData.dateOfBirth,
      gender: childData.gender,
      nationality: childData.nationality,
      bloodType: childData.bloodType || '',
      avatarUrl: childData.avatarUrl
    };
    setRegistrants([...registrants, newRegistrant]);
    setAddChildDialogOpen(false);
    
    toast({
      title: "Child added",
      description: `${childData.name} has been added to the registration`
    });
  };

  const formatScheduleDisplay = (schedules: any[]) => {
    if (!schedules || schedules.length === 0) return null;
    
    const grouped: Record<string, string[]> = {};
    schedules.forEach(schedule => {
      const timeRange = `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`;
      if (!grouped[timeRange]) {
        grouped[timeRange] = [];
      }
      grouped[timeRange].push(schedule.day_of_week);
    });
    
    return Object.entries(grouped).map(([timeRange, days]) => ({
      days: days.join(', '),
      time: timeRange
    }));
  };

  const handleSubmit = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue with registration",
          variant: "destructive"
        });
        return;
      }

      // Skip profile/children creation in existing user mode
      if (!existingUserMode) {
        // Create or update profile based on registration type
        let profileData;
        
        if (registrationType === 'kids-only') {
          // Use guardian info for profile
          profileData = {
            user_id: user.id,
            name: guardianInfo.name,
            email: guardianInfo.email,
            phone: guardianInfo.phone,
            country_code: guardianInfo.countryCode,
            address: guardianInfo.address,
            nationality: guardianInfo.nationality,
            date_of_birth: new Date().toISOString().split('T')[0],
            gender: 'male' // Default for guardian-only registration
          };
        } else {
          // Use self registrant info for profile
          const selfReg = registrants.find(r => r.type === 'self');
          if (!selfReg) throw new Error('Self registrant not found');
          
          profileData = {
            user_id: user.id,
            name: selfReg.name,
            email: selfReg.email!,
            phone: selfReg.phone!,
            country_code: selfReg.countryCode!,
            address: selfReg.address,
            nationality: selfReg.nationality,
            date_of_birth: selfReg.dateOfBirth,
            gender: selfReg.gender
          };
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData);

        if (profileError) throw profileError;
      }

      // Process each registrant
      for (const reg of registrants) {
        let memberId: string;

        if (reg.type === 'self') {
          // Create club member for self
          const { data: member, error: memberError } = await supabase
            .from('club_members')
            .insert({
              club_id: clubId,
              user_id: user.id,
              name: reg.name,
              rank: 'Beginner',
              avatar_url: reg.avatarUrl,
              payment_screenshot_url: payLater ? null : paymentScreenshotUrl
            })
            .select()
            .single();

          if (memberError) throw memberError;
          memberId = member.id;
        } else {
          // For existing user mode, find existing child by matching data
          let childId = null;
          if (existingUserMode && existingChildren) {
            const existingChild = existingChildren.find(c => 
              c.name === reg.name && 
              c.date_of_birth === reg.dateOfBirth
            );
            childId = existingChild?.id;
          }

          // Only create child if not in existing user mode
          if (!existingUserMode || !childId) {
            const { data: child, error: childError } = await supabase
              .from('children')
              .insert({
                parent_user_id: user.id,
                name: reg.name,
                date_of_birth: reg.dateOfBirth,
                gender: reg.gender,
                nationality: reg.nationality,
                blood_type: reg.bloodType,
                avatar_url: reg.avatarUrl
              })
              .select()
              .single();

            if (childError) throw childError;
            childId = child.id;
          }

          // Create club member for child
          const { data: member, error: memberError } = await supabase
            .from('club_members')
            .insert({
              club_id: clubId,
              child_id: childId,
              name: reg.name,
              rank: 'Beginner',
              avatar_url: reg.avatarUrl,
              payment_screenshot_url: paymentScreenshotUrl
            })
            .select()
            .single();

          if (memberError) throw memberError;
          memberId = member.id;
        }

        // Enroll in package and trigger subscription workflow
        const { data: enrollment, error: enrollError } = await supabase
          .from('package_enrollments')
          .insert({
            member_id: memberId,
            package_id: reg.packageId,
            is_active: true
          })
          .select()
          .single();

        if (enrollError) throw enrollError;

        // Process subscription workflow (notification, thank you email, duplicate check)
        try {
          const { error: workflowError } = await supabase.functions.invoke('process-subscription-workflow', {
            body: {
              member_id: memberId,
              package_id: reg.packageId,
              club_id: clubId,
              enrolled_at: enrollment.enrolled_at
            }
          });

          if (workflowError) {
            console.error('Subscription workflow error:', workflowError);
            // Don't fail the registration, just log the error
          }
        } catch (workflowErr) {
          console.error('Failed to process subscription workflow:', workflowErr);
        }

        // Record income transactions for enrollment and package
        try {
          const pkg = packages.find(p => p.id === reg.packageId);
          const isFirstTimer = firstTimers.includes(reg.id);
          const enrollmentFee = isFirstTimer ? (clubData?.enrollment_fee || 0) : 0;
          
          // Create enrollment fee transaction if applicable
          if (enrollmentFee > 0) {
            await supabase.functions.invoke('create-transaction', {
              body: {
                club_id: clubId,
                member_id: memberId,
                transaction_type: 'enrollment_fee',
                description: `Enrollment Fee - ${reg.name}`,
                amount: enrollmentFee,
                vat_percentage_applied: clubData?.vat_percentage || 0,
                payment_method: payLater ? 'pending' : 'cash',
                payment_status: payLater ? 'pending' : 'paid',
                payment_proof_url: payLater ? null : paymentScreenshotUrl,
                member_name: reg.name,
                member_email: reg.type === 'self' ? reg.email : guardianInfo.email,
                member_phone: reg.type === 'self' ? `${reg.countryCode}${reg.phone}` : `${guardianInfo.countryCode}${guardianInfo.phone}`,
                enrollment_id: enrollment.id,
                notes: `First-time enrollment for ${reg.name}`
              }
            });
          }

          // Create package fee transaction
          if (pkg && pkg.price > 0) {
            await supabase.functions.invoke('create-transaction', {
              body: {
                club_id: clubId,
                member_id: memberId,
                transaction_type: 'package_fee',
                description: `Package: ${pkg.name} - ${reg.name}`,
                amount: pkg.price,
                vat_percentage_applied: clubData?.vat_percentage || 0,
                payment_method: payLater ? 'pending' : 'cash',
                payment_status: payLater ? 'pending' : 'paid',
                payment_proof_url: payLater ? null : paymentScreenshotUrl,
                member_name: reg.name,
                member_email: reg.type === 'self' ? reg.email : guardianInfo.email,
                member_phone: reg.type === 'self' ? `${reg.countryCode}${reg.phone}` : `${guardianInfo.countryCode}${guardianInfo.phone}`,
                enrollment_id: enrollment.id,
                package_price_version_id: null,
                notes: `${pkg.duration_months}-month package for ${reg.name}`
              }
            });
          }
        } catch (transactionErr) {
          console.error('Failed to create income transaction:', transactionErr);
          // Don't fail the registration, just log the error
        }
      }

      // Send registration receipt email
      if (existingUserMode) {
        const receiptMembers = registrants.map(reg => {
          const pkg = packages.find(p => p.id === reg.packageId);
          return {
            name: reg.name,
            packageName: pkg?.name || '',
            packagePrice: pkg?.price || 0
          };
        });

        // Determine recipient (guardian or self)
        let recipientName, recipientEmail, recipientPhone, recipientAddress;
        if (registrationType === 'kids-only') {
          recipientName = guardianInfo.name;
          recipientEmail = guardianInfo.email;
          recipientPhone = `${guardianInfo.countryCode}${guardianInfo.phone}`;
          recipientAddress = guardianInfo.address;
        } else {
          const selfReg = registrants.find(r => r.type === 'self');
          recipientName = selfReg?.name || userProfile?.name;
          recipientEmail = selfReg?.email || userProfile?.email;
          recipientPhone = `${selfReg?.countryCode || userProfile?.country_code}${selfReg?.phone || userProfile?.phone}`;
          recipientAddress = selfReg?.address || userProfile?.address;
        }

        // Calculate enrollment fee for receipt
        const enrollmentFeePerMember = firstTimers.length > 0 ? (clubData?.enrollment_fee || 0) : 0;

        try {
          const { error: receiptError } = await supabase.functions.invoke(
            'send-registration-receipt',
            {
              body: {
                clubId: clubId,
                parentName: recipientName,
                parentEmail: recipientEmail,
                parentPhone: recipientPhone,
                parentAddress: recipientAddress,
                members: receiptMembers,
                enrollmentFee: enrollmentFeePerMember
              }
            }
          );

          if (receiptError) {
            console.error('Failed to send receipt email:', receiptError);
            // Don't fail the registration, just log the error
          }
        } catch (emailError) {
          console.error('Error sending receipt:', emailError);
        }
      }

      toast({
        title: "Registration successful!",
        description: `Successfully registered ${registrants.length} member(s). Receipt sent to your email.`
      });

      onComplete?.();
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive"
      });
    }
  };

  const handleRegistrationTypeSelect = (type: 'self' | 'self-and-kids' | 'kids-only') => {
    setRegistrationType(type);
    setRegistrants([]);

    if (existingUserMode && userProfile) {
      // Pre-populate with existing data
      if (type === 'self') {
        const selfRegistrant: Registrant = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'self',
          packageId: initialPackageId || '',
          name: userProfile.name,
          dateOfBirth: userProfile.date_of_birth,
          gender: userProfile.gender,
          nationality: userProfile.nationality,
          bloodType: userProfile.blood_type || '',
          avatarUrl: userProfile.avatar_url,
          email: userProfile.email,
          phone: userProfile.phone,
          countryCode: userProfile.country_code,
          address: userProfile.address
        };
        setRegistrants([selfRegistrant]);
      } else if (type === 'self-and-kids') {
        const selfRegistrant: Registrant = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'self',
          packageId: initialPackageId || '',
          name: userProfile.name,
          dateOfBirth: userProfile.date_of_birth,
          gender: userProfile.gender,
          nationality: userProfile.nationality,
          bloodType: userProfile.blood_type || '',
          avatarUrl: userProfile.avatar_url,
          email: userProfile.email,
          phone: userProfile.phone,
          countryCode: userProfile.country_code,
          address: userProfile.address
        };
        const childRegistrants: Registrant[] = (existingChildren || []).map(child => ({
          id: Math.random().toString(36).substr(2, 9),
          type: 'child',
          packageId: initialPackageId || '',
          name: child.name,
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          nationality: child.nationality,
          bloodType: child.blood_type || '',
          avatarUrl: child.avatar_url
        }));
        setRegistrants([selfRegistrant, ...childRegistrants]);
      } else if (type === 'kids-only') {
        const childRegistrants: Registrant[] = (existingChildren || []).map(child => ({
          id: Math.random().toString(36).substr(2, 9),
          type: 'child',
          packageId: initialPackageId || '',
          name: child.name,
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          nationality: child.nationality,
          bloodType: child.blood_type || '',
          avatarUrl: child.avatar_url
        }));
        setRegistrants(childRegistrants);
        // Don't auto-add empty child - let user add via "Add Child" button
      }
    } else {
      // Old behavior for non-existing user mode
      if (type === 'self') {
        addRegistrant('self');
      } else if (type === 'self-and-kids') {
        addRegistrant('self');
        addRegistrant('child');
      } else if (type === 'kids-only') {
        addRegistrant('child');
      }
    }
  };

  const renderSelectType = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Who are you registering?</h2>
        <p className="text-muted-foreground">Choose your registration type</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg",
            registrationType === 'self' && "ring-2 ring-primary"
          )}
          onClick={() => handleRegistrationTypeSelect('self')}
        >
          <CardContent className="p-6 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold text-lg mb-2">Myself Only</h3>
            <p className="text-sm text-muted-foreground">Individual membership</p>
            {registrationType === 'self' && (
              <Badge className="mt-4">Selected</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg",
            registrationType === 'self-and-kids' && "ring-2 ring-primary"
          )}
          onClick={() => handleRegistrationTypeSelect('self-and-kids')}
        >
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold text-lg mb-2">Myself + Kids</h3>
            <p className="text-sm text-muted-foreground">Family membership</p>
            {registrationType === 'self-and-kids' && (
              <Badge className="mt-4">Selected</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg",
            registrationType === 'kids-only' && "ring-2 ring-primary"
          )}
          onClick={() => handleRegistrationTypeSelect('kids-only')}
        >
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold text-lg mb-2">Kids Only</h3>
            <p className="text-sm text-muted-foreground">Register children</p>
            {registrationType === 'kids-only' && (
              <Badge className="mt-4">Selected</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {(registrants.length > 0 || registrationType === 'kids-only') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Registrants ({registrants.length})</span>
              {registrationType === 'self-and-kids' || registrationType === 'kids-only' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddChildDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Child
                </Button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {registrants.length === 0 && registrationType === 'kids-only' ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No children added yet</p>
                <p className="text-sm">Click "Add Another Child" to get started</p>
              </div>
            ) : (
              registrants.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {/* Profile Picture/Avatar */}
                  {reg.avatarUrl ? (
                    <img 
                      src={reg.avatarUrl} 
                      alt={reg.name || 'Registrant'} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20">
                      {reg.type === 'self' ? (
                        <User className="h-6 w-6 text-primary" />
                      ) : (
                        <Users className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  )}
                  
                  {/* Name, Age, Gender */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-base">
                        {reg.name || (reg.type === 'self' ? 'Myself' : `Child ${registrants.filter(r => r.type === 'child').indexOf(reg) + 1}`)}
                      </p>
                      {reg.dateOfBirth && (
                        <Badge variant="secondary" className="text-xs">
                          {calculateAge(reg.dateOfBirth)} yrs
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{reg.gender || 'Gender not set'}</span>
                      {reg.gender && <span>•</span>}
                      <span>{reg.type === 'self' ? 'Adult' : 'Child'}</span>
                    </div>
                  </div>
                </div>
                {/* Only allow removing children if there's more than one, or if it's self */}
                {(reg.type === 'child' && registrants.filter(r => r.type === 'child').length > 1) || 
                 (reg.type === 'self' && registrationType === 'self-and-kids') ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRegistrant(reg.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDetails = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Registration Details</h2>
        <p className="text-muted-foreground">Fill in the information for all registrants</p>
      </div>

      {/* Guardian Information - Only for kids-only registration */}
      {registrationType === 'kids-only' && (
        <Card>
          <CardHeader>
            <CardTitle>Guardian/Billing Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardian-name">Full Name *</Label>
                <Input
                  id="guardian-name"
                  value={guardianInfo.name}
                  onChange={(e) => setGuardianInfo({ ...guardianInfo, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian-email">Email *</Label>
                <Input
                  id="guardian-email"
                  type="email"
                  value={guardianInfo.email}
                  onChange={(e) => setGuardianInfo({ ...guardianInfo, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <PhoneInput
                  countryCode={guardianInfo.countryCode}
                  phoneNumber={guardianInfo.phone}
                  onCountryCodeChange={(code) => setGuardianInfo({ ...guardianInfo, countryCode: code })}
                  onPhoneNumberChange={(phone) => setGuardianInfo({ ...guardianInfo, phone })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian-nationality">Nationality *</Label>
                <SearchableSelect
                  value={guardianInfo.nationality}
                  onValueChange={(value) => setGuardianInfo({ ...guardianInfo, nationality: value })}
                  options={nationalityOptions}
                  placeholder="Select nationality"
                  searchPlaceholder="Search countries..."
                  emptyMessage="No country found."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="guardian-address">Address</Label>
                <Input
                  id="guardian-address"
                  value={guardianInfo.address}
                  onChange={(e) => setGuardianInfo({ ...guardianInfo, address: e.target.value })}
                  placeholder="123 Main St, City, Country"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Each Registrant */}
      {registrants.map((reg, index) => {
        const eligibility = checkEligibility(reg);
        const age = reg.dateOfBirth ? calculateAge(reg.dateOfBirth) : null;
        
        return (
          <Card key={reg.id} className={cn(!eligibility.eligible && "border-destructive")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {reg.type === 'self' ? 'Your Information' : `Child ${registrants.filter(r => r.type === 'child').indexOf(reg) + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  {!eligibility.eligible && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Not Eligible
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRegistrant(reg.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!eligibility.eligible && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{reg.name || 'This person'}</strong> is not eligible for the selected package. {eligibility.reason}
                    {age !== null && <span className="block mt-1">Current age: {age} years</span>}
                  </AlertDescription>
                </Alert>
              )}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={reg.name}
                  onChange={(e) => updateRegistrant(reg.id, 'name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              
              {/* Email field for self type */}
              {reg.type === 'self' && (
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={reg.email || ''}
                    onChange={(e) => updateRegistrant(reg.id, 'email', e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input
                  type="date"
                  value={reg.dateOfBirth}
                  onChange={(e) => updateRegistrant(reg.id, 'dateOfBirth', e.target.value)}
                />
              </div>
              
              {/* Phone field for self type */}
              {reg.type === 'self' && (
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <PhoneInput
                    countryCode={reg.countryCode || '+1'}
                    phoneNumber={reg.phone || ''}
                    onCountryCodeChange={(code) => updateRegistrant(reg.id, 'countryCode', code)}
                    onPhoneNumberChange={(phone) => updateRegistrant(reg.id, 'phone', phone)}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Gender *</Label>
                <Select
                  value={reg.gender}
                  onValueChange={(value) => updateRegistrant(reg.id, 'gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blood Type *</Label>
                <Select
                  value={reg.bloodType}
                  onValueChange={(value) => updateRegistrant(reg.id, 'bloodType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label>Nationality *</Label>
                <SearchableSelect
                  value={reg.nationality}
                  onValueChange={(value) => updateRegistrant(reg.id, 'nationality', value)}
                  options={nationalityOptions}
                  placeholder="Select nationality"
                  searchPlaceholder="Search countries..."
                  emptyMessage="No country found."
                />
              </div>
              
              {/* Address field for self type */}
              {reg.type === 'self' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={reg.address || ''}
                    onChange={(e) => updateRegistrant(reg.id, 'address', e.target.value)}
                    placeholder="123 Main St, City, Country"
                  />
                </div>
              )}
              
              <div className="space-y-2 md:col-span-2">
                <Label>Package *</Label>
                <Select
                  value={reg.packageId}
                  onValueChange={(value) => updateRegistrant(reg.id, 'packageId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - {formatCurrency(pkg.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );

  const renderPackageSelection = () => (
    <div className="w-full space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Select Packages</h2>
        <p className="text-muted-foreground">Choose a package for each registrant</p>
      </div>

      {registrants
        .filter(reg => {
          // Only show relevant registrants based on registration type
          if (registrationType === 'kids-only') {
            return reg.type === 'child';
          }
          return true; // Show all for other types
        })
        .map((reg) => {
        const age = reg.dateOfBirth ? calculateAge(reg.dateOfBirth) : null;
        const eligiblePackages = packages.filter(pkg => {
          // Filter by age
          if (age !== null) {
            if (pkg.age_min && age < pkg.age_min) return false;
            if (pkg.age_max && age > pkg.age_max) return false;
          }
          // Filter by gender
          if (pkg.gender_restriction && pkg.gender_restriction !== 'mixed' && reg.gender) {
            if (pkg.gender_restriction !== reg.gender) return false;
          }
          return true;
        });

        return (
          <Card key={reg.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {reg.avatarUrl ? (
                  <img src={reg.avatarUrl} alt={reg.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {reg.type === 'self' ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{reg.name}</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    {age !== null && `${age} years old • `}
                    {reg.gender.charAt(0).toUpperCase() + reg.gender.slice(1)}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eligiblePackages.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No eligible packages found for {reg.name}. Please contact the club administrator.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <Label>Available Packages ({eligiblePackages.length})</Label>
                  <div className="space-y-4">
                    {eligiblePackages.map((pkg) => {
                      const pkgActivities = packageActivities[pkg.id] || [];
                      
                      // Aggregate ALL schedules across all activities
                      const allSchedules = pkgActivities.flatMap(pa => pa.activities?.activity_schedules || []);
                      const formattedSchedules = formatScheduleDisplay(allSchedules);
                      
                      // Deduplicate instructors
                      const instructorsMap = new Map();
                      pkgActivities.forEach(pa => {
                        if (pa.club_instructors && pa.club_instructors.id) {
                          instructorsMap.set(pa.club_instructors.id, pa.club_instructors);
                        }
                      });
                      const instructors = Array.from(instructorsMap.values());
                      
                      return (
                      <Card
                        key={pkg.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          reg.packageId === pkg.id 
                            ? "ring-2 ring-primary shadow-lg" 
                            : "hover:ring-1 hover:ring-muted-foreground/30"
                        )}
                        onClick={() => {
                          // Toggle: if already selected, clear selection
                          const newPackageId = reg.packageId === pkg.id ? '' : pkg.id;
                          updateRegistrant(reg.id, 'packageId', newPackageId);
                        }}
                      >
                        <CardContent className="p-6 space-y-4">
                          {/* Header Section */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg">{pkg.name}</h4>
                                {reg.packageId === pkg.id && (
                                  <Badge variant="default" className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {pkg.duration_months} months • {pkg.activity_type}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {formatCurrency(pkg.price)}
                              </div>
                              <div className="text-xs text-muted-foreground">per month</div>
                            </div>
                          </div>

                          {/* Schedule Section */}
                          {formattedSchedules && formattedSchedules.length > 0 && (
                            <div className="space-y-2 pt-3 border-t">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="h-4 w-4 text-primary" />
                                Schedule
                              </div>
                              <div className="space-y-1 pl-6">
                                {formattedSchedules.map((schedule, idx) => (
                                  <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    {schedule.days}: {schedule.time}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Instructors Section */}
                          {instructors.length > 0 && (
                            <div className="space-y-2 pt-3 border-t">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <User className="h-4 w-4 text-primary" />
                                Instructors
                              </div>
                              <div className="space-y-2 pl-6">
                                {instructors.map((instructor, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    {instructor.image_url ? (
                                      <img 
                                        src={instructor.image_url} 
                                        alt={instructor.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium">{instructor.name}</div>
                                      <div className="text-xs text-muted-foreground">{instructor.specialty}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Eligibility Section */}
                          <div className="space-y-1 pt-3 border-t">
                            <div className="text-sm font-medium text-muted-foreground">Eligibility</div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {(pkg.age_min || pkg.age_max) && (
                                <Badge variant="secondary" className="font-normal">
                                  Ages: {pkg.age_min || '0'} - {pkg.age_max || '∞'} years
                                </Badge>
                              )}
                              {pkg.gender_restriction && pkg.gender_restriction !== 'mixed' && (
                                <Badge variant="secondary" className="font-normal">
                                  Gender: {pkg.gender_restriction}
                                </Badge>
                              )}
                              {(!pkg.gender_restriction || pkg.gender_restriction === 'mixed') && (
                                <Badge variant="secondary" className="font-normal">
                                  Gender: Mixed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderPaymentReview = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Review & Payment</h2>
        <p className="text-muted-foreground">Review your selection and upload payment proof</p>
      </div>

      {/* Registrants Summary */}
      {registrants.map((reg) => {
        const pkg = packages.find(p => p.id === reg.packageId);
        return (
          <Card key={reg.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {reg.avatarUrl ? (
                  <img src={reg.avatarUrl} alt={reg.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {reg.type === 'self' ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">{reg.name}</div>
                  <Badge variant="outline">{reg.type === 'self' ? 'Adult' : 'Child'}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pkg && (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {pkg.duration_months} months • {pkg.activity_type}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-primary">{formatCurrency(pkg.price)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Detailed Billing Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Billing Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Package fees */}
          {registrants.map((reg) => {
            const pkg = packages.find(p => p.id === reg.packageId);
            return pkg ? (
              <div key={reg.id} className="flex justify-between items-center pb-2 border-b">
                <div>
                  <p className="font-medium">{reg.name}</p>
                  <p className="text-sm text-muted-foreground">{pkg.name} - {pkg.duration_months} months</p>
                </div>
                <p className="font-semibold">{pkg.price.toFixed(2)} {clubData?.currency || currency}</p>
              </div>
            ) : null;
          })}
          
          {/* Enrollment fee */}
          {firstTimers.length > 0 && clubData?.enrollment_fee && clubData.enrollment_fee > 0 && (
            <div className="flex justify-between items-center py-2 bg-blue-50 dark:bg-blue-950 px-3 rounded">
              <div>
                <p className="font-medium">Enrollment Fee</p>
                <p className="text-sm text-muted-foreground">
                  One-time fee for {firstTimers.length} new member{firstTimers.length > 1 ? 's' : ''}:
                  {firstTimers.map(id => {
                    const reg = registrants.find(r => r.id === id);
                    return reg ? ` ${reg.name}` : '';
                  }).join(',')}
                </p>
              </div>
              <p className="font-semibold">
                {(clubData.enrollment_fee * firstTimers.length).toFixed(2)} {clubData?.currency || currency}
              </p>
            </div>
          )}
          
          {/* Subtotal */}
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="font-medium">Subtotal</p>
            <p className="font-semibold">
              {(() => {
                const packageTotal = registrants.reduce((sum, reg) => {
                  const pkg = packages.find(p => p.id === reg.packageId);
                  return sum + (pkg?.price || 0);
                }, 0);
                const enrollmentTotal = firstTimers.length * (clubData?.enrollment_fee || 0);
                return (packageTotal + enrollmentTotal).toFixed(2);
              })()} {clubData?.currency || currency}
            </p>
          </div>
          
          {/* VAT (conditional) */}
          {clubData?.vat_registration_number && clubData.vat_percentage > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">VAT ({clubData.vat_percentage}%)</p>
              <p className="text-sm font-medium">
                {(() => {
                  const packageTotal = registrants.reduce((sum, reg) => {
                    const pkg = packages.find(p => p.id === reg.packageId);
                    return sum + (pkg?.price || 0);
                  }, 0);
                  const enrollmentTotal = firstTimers.length * (clubData?.enrollment_fee || 0);
                  const subtotal = packageTotal + enrollmentTotal;
                  const vat = subtotal * (clubData.vat_percentage / 100);
                  return vat.toFixed(2);
                })()} {clubData?.currency || currency}
              </p>
            </div>
          )}
          
          {/* Grand Total */}
          <div className="flex justify-between items-center pt-3 border-t-2 border-primary">
            <p className="text-xl font-bold">Grand Total</p>
            <p className="text-2xl font-bold text-primary">
              {calculateTotal().toFixed(2)} {clubData?.currency || currency}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Screenshot Upload */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Payment Proof
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pay Later Option */}
          <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox 
              id="pay-later" 
              checked={payLater}
              onCheckedChange={(checked) => {
                setPayLater(checked as boolean);
                if (checked) {
                  setPaymentScreenshotUrl('');
                  setPaymentScreenshot(null);
                }
              }}
            />
            <div className="space-y-1 flex-1">
              <Label htmlFor="pay-later" className="cursor-pointer font-medium">
                I'll pay later
              </Label>
              <p className="text-sm text-muted-foreground">
                The club owner will review your registration and send a payment proposal
              </p>
            </div>
          </div>

          {!payLater && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please upload a screenshot or photo of your payment confirmation. Registration will only be completed after payment verification.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <Label htmlFor="payment-upload">Upload Payment Screenshot *</Label>
                <Input
                  id="payment-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePaymentScreenshotUpload(file);
                    }
                  }}
                />
            
                {paymentScreenshot && paymentScreenshotUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Payment screenshot uploaded successfully</span>
                    </div>
                    <div className="relative w-full max-w-md">
                      <img 
                        src={paymentScreenshotUrl} 
                        alt="Payment proof" 
                        className="w-full h-auto rounded-lg border"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Review & Confirm</h2>
        <p className="text-muted-foreground">Please review your registration details</p>
      </div>

      {/* Account Holder Info - Show guardian info for kids-only, self info otherwise */}
      {registrationType === 'kids-only' ? (
        <Card>
          <CardHeader>
            <CardTitle>Guardian/Billing Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{guardianInfo.name}</span>
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{guardianInfo.email}</span>
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{guardianInfo.countryCode} {guardianInfo.phone}</span>
              <span className="text-muted-foreground">Nationality:</span>
              <span className="font-medium">{guardianInfo.nationality}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        registrants.find(r => r.type === 'self') && (
          <Card>
            <CardHeader>
              <CardTitle>Account Holder & Billing Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{registrants.find(r => r.type === 'self')?.name}</span>
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{registrants.find(r => r.type === 'self')?.email}</span>
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{registrants.find(r => r.type === 'self')?.countryCode} {registrants.find(r => r.type === 'self')?.phone}</span>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {registrants.map((reg) => {
        const pkg = packages.find(p => p.id === reg.packageId);
        return (
          <Card key={reg.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{reg.type === 'self' ? 'Your Membership' : reg.name}</span>
                <Badge>{reg.type === 'self' ? 'Adult' : 'Child'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{reg.name}</span>
                <span className="text-muted-foreground">Date of Birth:</span>
                <span className="font-medium">{reg.dateOfBirth}</span>
                <span className="text-muted-foreground">Gender:</span>
                <span className="font-medium capitalize">{reg.gender}</span>
                <span className="text-muted-foreground">Nationality:</span>
                <span className="font-medium">{reg.nationality}</span>
              </div>
              {pkg && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pkg.duration_months} months • {pkg.activity_type}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-primary">{formatCurrency(pkg.price)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Total Amount</span>
            </div>
            <span className="text-3xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Monthly payment for {registrants.length} member{registrants.length > 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
            step === 'select-type' ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            1
          </div>
          <div className="w-16 h-1 bg-muted" />
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
            (existingUserMode ? step === 'package-selection' : step === 'details') ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            2
          </div>
          <div className="w-16 h-1 bg-muted" />
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
            (existingUserMode ? step === 'payment-review' : step === 'review') ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            3
          </div>
        </div>
      </div>

      {/* Step Content */}
      {step === 'select-type' && renderSelectType()}
      {step === 'package-selection' && renderPackageSelection()}
      {step === 'payment-review' && renderPaymentReview()}
      {step === 'details' && renderDetails()}
      {step === 'review' && renderReview()}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => {
            if (step === 'select-type') onCancel?.();
            else if (existingUserMode) {
              if (step === 'package-selection') setStep('select-type');
              else if (step === 'payment-review') setStep('package-selection');
            } else {
              if (step === 'details') setStep('select-type');
              else if (step === 'review') setStep('details');
            }
          }}
        >
          {step === 'select-type' ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={() => {
            if (existingUserMode && step === 'payment-review') handleSubmit();
            else if (!existingUserMode && step === 'review') handleSubmit();
            else handleNext();
          }}
          disabled={
            registrants.length === 0 || 
            (step === 'payment-review' && !payLater && !paymentScreenshotUrl)
          }
        >
          {(existingUserMode && step === 'payment-review') || (!existingUserMode && step === 'review') 
            ? (payLater ? 'Complete Registration (Payment Pending)' : 'Complete Registration') 
            : 'Next'}
        </Button>
      </div>

      {/* Add Child Dialog */}
      <AddChildDialog
        open={addChildDialogOpen}
        onOpenChange={setAddChildDialogOpen}
        parentNationality={
          existingUserMode 
            ? userProfile?.nationality 
            : guardianInfo.nationality
        }
        onChildAdded={handleChildAdded}
      />
    </div>
  );
};

export default MembershipRegistrationFlow;
