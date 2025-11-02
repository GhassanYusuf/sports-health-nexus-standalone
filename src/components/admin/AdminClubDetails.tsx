import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Trash2, Plus, Upload, MapPin, QrCode, Landmark, Building2, Star, Edit, User, Hash, Globe, Code, Shield, Instagram, Facebook, Twitter, Linkedin, Youtube, Music2, ExternalLink, Mail, Phone, X, Ghost, MessageCircle, MessageSquare, PhoneCall, Copy } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CountrySelector } from "@/components/CountrySelector";
import { getCountryData } from "@/lib/countryUtils";
import countries from "world-countries";
import LeafletLocationMap from "@/components/LeafletLocationMap";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DeleteClubDialog } from "./DeleteClubDialog";

interface AdminClubDetailsProps {
  clubId: string;
  onUpdate?: () => void;
  onClubDeleted?: () => void;
}

interface LinkTreeItem {
  title: string;
  url: string;
}


export const AdminClubDetails: React.FC<AdminClubDetailsProps> = ({ clubId, onUpdate, onClubDeleted }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slogan: "",
    welcoming_message: "",
    location: "",
    gps_latitude: "",
    gps_longitude: "",
    map_zoom: "13",
    logo_url: "",
    image_url: "",
    favicon_url: "",
    owner_name: "",
    owner_contact: "",
    owner_contact_code: "",
    owner_email: "",
    club_email: "",
    club_phone: "",
    club_phone_code: "",
    currency: "USD",
    timezone: "UTC",
    club_slug: "",
    country_iso: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_iban: "",
    bank_swift_code: "",
    member_code_prefix: "MEM",
    invoice_code_prefix: "INV",
    receipt_code_prefix: "REC",
    expense_code_prefix: "EXP",
    specialist_code_prefix: "SPEC",
    child_code_prefix: "CHILD",
    enrollment_fee: "",
    commercial_registration_number: "",
    vat_registration_number: "",
    vat_percentage: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Prepare currency options from world-countries
  const currencyOptions = React.useMemo(() => {
    const uniqueCurrencies = new Map();
    
    countries
      .filter((country) => country.cca2 !== "IL") // Exclude Israel
      .forEach((country) => {
        const currencyCodes = Object.keys(country.currencies || {});
        currencyCodes.forEach((code) => {
          if (!uniqueCurrencies.has(code)) {
            const currency = country.currencies[code];
            uniqueCurrencies.set(code, {
              value: code,
              label: `${country.name.common} - ${code} (${currency.symbol || ""})`,
              icon: country.flag,
              country: country.name.common,
              symbol: currency.symbol || "",
            });
          }
        });
      });

    return Array.from(uniqueCurrencies.values()).sort((a, b) => 
      a.country.localeCompare(b.country)
    );
  }, []);

  // Prepare timezone options with common IANA timezones
  const timezoneOptions = React.useMemo(() => {
    const commonTimezones = [
      { region: "Africa", zones: ["Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi"] },
      { region: "America", zones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires"] },
      { region: "Asia", zones: ["Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Bahrain", "Asia/Qatar", "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Seoul", "Asia/Kolkata", "Asia/Bangkok", "Asia/Jakarta"] },
      { region: "Europe", zones: ["Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid", "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Stockholm", "Europe/Moscow"] },
      { region: "Pacific", zones: ["Pacific/Auckland", "Pacific/Sydney", "Pacific/Fiji"] },
      { region: "UTC", zones: ["UTC"] },
    ];

    const allZones: Array<{ value: string; label: string; icon: string }> = [];
    
    commonTimezones.forEach(({ zones }) => {
      zones.forEach((tz) => {
        const matchingCountry = countries.find((c) => {
          const cityName = tz.split('/')[1]?.replace(/_/g, ' ');
          return c.capital?.some(cap => cap.toLowerCase() === cityName?.toLowerCase()) ||
                 c.name.common.replace(/\s/g, '_').toLowerCase() === cityName?.toLowerCase();
        });
        
        allZones.push({
          value: tz,
          label: tz,
          icon: matchingCountry?.flag || "🌍",
        });
      });
    });

    return allZones.sort((a, b) => a.value.localeCompare(b.value));
  }, []);
  const [linkTree, setLinkTree] = useState<LinkTreeItem[]>([]);
  
  // State for bank accounts
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [newBankAccount, setNewBankAccount] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    iban: "",
    swift_code: "",
    is_primary: false,
  });
  const [editingBankAccount, setEditingBankAccount] = useState<any>(null);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [isEditLinkDialogOpen, setIsEditLinkDialogOpen] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editLink, setEditLink] = useState({ title: "", url: "" });
  const [openingHours, setOpeningHours] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Image upload hooks
  const logoUpload = useImageUpload({
    aspectRatioType: "square",
    maxOutputSize: 1024,
    onSuccess: (url) => {
      setFormData(prev => ({ ...prev, logo_url: url }));
      // Auto-save logo update
      setTimeout(async () => {
        await supabase.from("clubs").update({ logo_url: url }).eq("id", clubId);
        if (onUpdate) onUpdate();
        toast({ title: "Logo updated successfully" });
      }, 100);
    },
  });

  const faviconUpload = useImageUpload({
    aspectRatioType: "square",
    maxOutputSize: 512,
    onSuccess: (url) => {
      setFormData(prev => ({ ...prev, favicon_url: url }));
      // Auto-save favicon update
      setTimeout(async () => {
        await supabase.from("clubs").update({ favicon_url: url }).eq("id", clubId);
        if (onUpdate) onUpdate();
        toast({ title: "Favicon updated successfully" });
      }, 100);
    },
  });

  const coverUpload = useImageUpload({
    aspectRatioType: "cover",
    maxOutputSize: 1920,
    onSuccess: (url) => {
      setFormData(prev => ({ ...prev, image_url: url }));
      // Auto-save cover image update
      setTimeout(async () => {
        await supabase.from("clubs").update({ image_url: url }).eq("id", clubId);
        if (onUpdate) onUpdate();
        toast({ title: "Cover image updated successfully" });
      }, 100);
    },
  });

  useEffect(() => {
    if (clubId) {
      fetchClubDetails();
      fetchBankAccounts();
    }
  }, [clubId]);

  const fetchClubDetails = async () => {
    if (!clubId) {
      console.log("No clubId provided");
      return;
    }
    
    console.log("Fetching club details for:", clubId);
    setLoading(true);
    setDataLoaded(false);
    
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();

    if (error) {
      console.error("Error fetching club details:", error);
      toast({ title: "Error fetching club details", description: error.message, variant: "destructive" });
    } else if (data) {
      console.log("Club data fetched successfully:", data);
      const newFormData = {
        name: data.name || "",
        description: data.description || "",
        slogan: data.slogan || "",
        welcoming_message: data.welcoming_message || "",
        location: data.location || "",
        gps_latitude: data.gps_latitude?.toString() || "",
        gps_longitude: data.gps_longitude?.toString() || "",
        map_zoom: data.map_zoom?.toString() || "13",
        logo_url: data.logo_url || "",
        image_url: data.image_url || "",
        favicon_url: data.favicon_url || "",
        owner_name: data.owner_name || "",
        owner_contact: data.owner_contact || "",
        owner_contact_code: data.owner_contact_code || "",
        owner_email: data.owner_email || "",
        club_email: data.club_email || "",
        club_phone: data.club_phone || "",
        club_phone_code: data.club_phone_code || "",
        currency: data.currency || "USD",
        timezone: data.timezone || "UTC",
        club_slug: data.club_slug || "",
        country_iso: data.country_iso || "",
        bank_name: data.bank_name || "",
        bank_account_name: data.bank_account_name || "",
        bank_account_number: data.bank_account_number || "",
        bank_iban: data.bank_iban || "",
        bank_swift_code: data.bank_swift_code || "",
        member_code_prefix: data.member_code_prefix || "MEM",
        invoice_code_prefix: data.invoice_code_prefix || "INV",
        receipt_code_prefix: data.receipt_code_prefix || "REC",
        expense_code_prefix: data.expense_code_prefix || "EXP",
        specialist_code_prefix: data.specialist_code_prefix || "SPEC",
        child_code_prefix: data.child_code_prefix || "CHILD",
        enrollment_fee: data.enrollment_fee?.toString() || "0",
        commercial_registration_number: data.commercial_registration_number || "",
        vat_registration_number: data.vat_registration_number || "",
        vat_percentage: data.vat_percentage?.toString() || "0",
      };
      console.log("Setting form data:", newFormData);
      setFormData(newFormData);
      setLinkTree(Array.isArray(data.link_tree) ? data.link_tree as unknown as LinkTreeItem[] : []);
    }
    
    setDataLoaded(true);
    setLoading(false);
  };

  // Fetch bank accounts
  const fetchBankAccounts = async () => {
    const { data, error } = await supabase.functions.invoke("bank-accounts", {
      body: { action: "list", clubId },
    });

    if (error) {
      console.error("Error fetching bank accounts:", error);
      toast({ title: "Error fetching bank accounts", description: error.message, variant: "destructive" });
    } else if (data?.data) {
      setBankAccounts(data.data);
    }
  };

  // Handle country change and auto-populate related fields
  const handleCountryChange = (isoCode: string) => {
    const countryData = getCountryData(isoCode);
    if (countryData) {
      setFormData(prev => ({
        ...prev,
        country_iso: isoCode,
        currency: countryData.currency,
        timezone: countryData.timezone,
        club_phone_code: countryData.phoneCode,
      }));
      toast({
        title: "Country settings updated",
        description: `Currency: ${countryData.currency}, Timezone: ${countryData.timezone}`,
      });
    }
  };

  const handleUpdateClub = async () => {
    if (!dataLoaded) {
      toast({ title: "Please wait", description: "Club data is still loading.", variant: "destructive" });
      return;
    }
    if (!formData.name?.trim()) {
      toast({ title: "Club name is required", description: "Please enter a club name before saving.", variant: "destructive" });
      return;
    }
    
    // Validate country code and club slug for SEO-friendly URLs
    if (!formData.country_iso || formData.country_iso.length !== 2) {
      toast({ title: "Country code required", description: "Please enter a valid 2-letter country code (e.g., BH, AE, US).", variant: "destructive" });
      return;
    }
    
    if (!formData.club_slug || formData.club_slug.length < 2) {
      toast({ title: "Club slug required", description: "Please enter a valid club slug (at least 2 characters).", variant: "destructive" });
      return;
    }
    setLoading(true);
    
    // Update club information
    const { error } = await supabase
      .from("clubs")
      .update({
        name: formData.name,
        description: formData.description,
        slogan: formData.slogan,
        welcoming_message: formData.welcoming_message,
        location: formData.location,
        gps_latitude: formData.gps_latitude ? parseFloat(formData.gps_latitude) : null,
        gps_longitude: formData.gps_longitude ? parseFloat(formData.gps_longitude) : null,
        map_zoom: formData.map_zoom ? parseInt(formData.map_zoom) : 13,
        // logo_url, image_url, favicon_url are updated via dedicated upload handlers
        owner_name: formData.owner_name,
        owner_contact: formData.owner_contact,
        owner_contact_code: formData.owner_contact_code,
        owner_email: formData.owner_email,
        club_email: formData.club_email,
        club_phone: formData.club_phone,
        club_phone_code: formData.club_phone_code,
        currency: formData.currency,
        timezone: formData.timezone,
        club_slug: formData.club_slug,
        country_iso: formData.country_iso || null,
        member_code_prefix: formData.member_code_prefix,
        invoice_code_prefix: formData.invoice_code_prefix,
        receipt_code_prefix: formData.receipt_code_prefix,
        expense_code_prefix: formData.expense_code_prefix,
        specialist_code_prefix: formData.specialist_code_prefix,
        child_code_prefix: formData.child_code_prefix,
        enrollment_fee: formData.enrollment_fee ? parseFloat(formData.enrollment_fee) : 0,
        commercial_registration_number: formData.commercial_registration_number || null,
        vat_registration_number: formData.vat_registration_number || null,
        vat_percentage: formData.vat_percentage ? parseFloat(formData.vat_percentage) : 0,
        link_tree: linkTree as any,
      })
      .eq("id", clubId);

    if (error) {
      setLoading(false);
      toast({ title: "Error updating club", description: error.message, variant: "destructive" });
      return;
    }

    // If owner details are provided, create/update owner profile
    if (formData.owner_name && formData.owner_email && formData.owner_contact) {
      try {
        // First, find the owner's user_id from club_members or profiles
        let ownerId = null;
        
        // Try to find existing owner from club_members
        const { data: ownerMember } = await supabase
          .from("club_members")
          .select("user_id")
          .eq("club_id", clubId)
          .eq("rank", "Owner")
          .eq("is_active", true)
          .maybeSingle();
        
        if (ownerMember?.user_id) {
          ownerId = ownerMember.user_id;
        } else {
          // Try to find user by email from profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", formData.owner_email)
            .maybeSingle();
          
          if (profile?.user_id) {
            ownerId = profile.user_id;
          }
        }
        
        if (ownerId) {
          const { data: ownerData, error: ownerError } = await supabase.functions.invoke("create-club-owner", {
            body: {
              user_id: ownerId,
              club_id: clubId,
            },
          });

          if (ownerError) {
            console.error("Owner profile error:", ownerError);
            toast({ 
              title: "Club updated but owner profile error", 
              description: ownerError.message,
              variant: "destructive"
            });
          } else if (ownerData?.error) {
            console.error("Owner profile error:", ownerData.error);
            toast({ 
              title: "Club updated but owner profile error", 
              description: ownerData.error,
              variant: "destructive" 
            });
          } else {
            toast({ 
              title: "Success", 
              description: ownerData.message || "Club and owner profile updated successfully" 
            });
          }
        } else {
          toast({ 
            title: "Club updated", 
            description: "Owner user account not found. Owner details saved to club.",
            variant: "default" 
          });
        }
      } catch (ownerErr) {
        console.error("Owner profile error:", ownerErr);
        toast({ 
          title: "Club updated", 
          description: "But there was an issue creating the owner profile",
          variant: "destructive" 
        });
      }
    } else {
      toast({ title: "Club updated successfully" });
    }

    setLoading(false);
    await fetchClubDetails(); // Refetch to show updated data
    onUpdate?.();
  };

  const handleSearchMembers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, name, email, phone, country_code")
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      setSearchResults(profiles || []);
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLinkOwner = (member: any) => {
    setFormData(prev => ({
      ...prev,
      owner_name: member.name,
      owner_email: member.email || "",
      owner_contact: member.phone || "",
      owner_contact_code: member.country_code || "+1",
    }));
    setSearchQuery("");
    setSearchResults([]);
    toast({
      title: "Owner linked",
      description: "Click 'Update Club' to save the changes",
    });
  };

  const SOCIAL_PLATFORMS = [
    { name: 'Instagram', url: 'https://instagram.com/', icon: Instagram, color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400' },
    { name: 'Facebook', url: 'https://facebook.com/', icon: Facebook, color: 'bg-blue-600' },
    { name: 'Twitter/X', url: 'https://twitter.com/', icon: Twitter, color: 'bg-black' },
    { name: 'LinkedIn', url: 'https://linkedin.com/company/', icon: Linkedin, color: 'bg-blue-700' },
    { name: 'YouTube', url: 'https://youtube.com/', icon: Youtube, color: 'bg-red-600' },
    { name: 'TikTok', url: 'https://tiktok.com/@', icon: Music2, color: 'bg-black' },
    { name: 'Snapchat', url: 'https://snapchat.com/add/', icon: Ghost, color: 'bg-yellow-400' },
    { name: 'WhatsApp', url: 'https://wa.me/', icon: MessageCircle, color: 'bg-emerald-600' },
    { name: 'Signal', url: 'https://signal.me/#p/', icon: MessageSquare, color: 'bg-blue-600' },
    { name: 'Phone', url: 'tel:', icon: PhoneCall, color: 'bg-emerald-600' },
    { name: 'Email', url: 'mailto:', icon: Mail, color: 'bg-green-600' },
    { name: 'Other', url: '', icon: Globe, color: 'bg-primary' },
  ];

  const linkSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(100),
    url: z.string().trim().min(1, 'URL is required').max(500),
  });

  const sanitizeLinkUrl = (raw: string) => {
    let url = raw.trim();
    if (!url) return url;

    const hasHttp = /^https?:\/\//i.test(url);
    const isMail = url.toLowerCase().startsWith('mailto:');
    const isTel = url.toLowerCase().startsWith('tel:');
    const isWaScheme = url.toLowerCase().startsWith('whatsapp:');
    const isSignalScheme = url.toLowerCase().startsWith('signal:');

    // Normalize WhatsApp and Signal web URLs
    if (url.includes('wa.me') || url.includes('whatsapp.com')) {
      if (!hasHttp) url = 'https://' + url;
      return url;
    }
    if (url.includes('signal.me') || url.includes('signal.group')) {
      if (!hasHttp) url = 'https://' + url;
      return url;
    }

    // Email address without scheme
    if (url.match(/^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/)) {
      return 'mailto:' + url;
    }
    // Phone without scheme
    if (!isTel && url.replace(/[\s()-]/g, '').match(/^\+?\d{6,}$/)) {
      return 'tel:' + url.replace(/\s+/g, '');
    }

    if (isMail || isTel || isWaScheme || isSignalScheme) return url;
    if (hasHttp) return url;

    return 'https://' + url;
  };

  const openExternalLink = (rawUrl: string) => {
    const safe = sanitizeLinkUrl(rawUrl);
    const win = window.open(safe, '_blank', 'noopener,noreferrer');
    if (win) (win as any).opener = null;
  };

  const addLinkToTree = () => {
    try {
      const parsed = linkSchema.parse(newLink);
      const safeUrl = sanitizeLinkUrl(parsed.url);
      setLinkTree([...linkTree, { title: parsed.title, url: safeUrl }]);
      setNewLink({ title: '', url: '' });
      setIsAddLinkDialogOpen(false);
      setSelectedPlatform('');
    } catch (e: any) {
      toast({
        title: 'Invalid link',
        description: e?.errors?.[0]?.message || 'Please provide a valid title and URL.',
        variant: 'destructive',
      });
    }
  };

  const handlePlatformSelect = (platformName: string) => {
    setSelectedPlatform(platformName);
    const platform = SOCIAL_PLATFORMS.find(p => p.name === platformName);
    if (platform) {
      setNewLink({ ...newLink, title: platform.name, url: platform.url });
    }
  };

  const removeLinkFromTree = (index: number) => {
    setLinkTree(linkTree.filter((_, i) => i !== index));
  };

  const startEditLink = (index: number) => {
    setEditingLinkIndex(index);
    setEditLink(linkTree[index]);
    setIsEditLinkDialogOpen(true);
  };

  const saveEditedLink = () => {
    try {
      const parsed = linkSchema.parse(editLink);
      const updated = [...linkTree];
      updated[editingLinkIndex as number] = { title: parsed.title, url: sanitizeLinkUrl(parsed.url) };
      setLinkTree(updated);
      setIsEditLinkDialogOpen(false);
      setEditingLinkIndex(null);
    } catch (e: any) {
      toast({
        title: 'Invalid link',
        description: e?.errors?.[0]?.message || 'Please provide a valid title and URL.',
        variant: 'destructive',
      });
    }
  };

  const generateQRCode = () => {
    if (formData.club_slug) {
      const url = `${window.location.origin}/club/${formData.club_slug}`;
      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, '_blank');
    }
  };

  const getSocialIcon = (url: string) => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('instagram.com')) return <Instagram className="h-5 w-5" />;
    if (urlLower.includes('facebook.com')) return <Facebook className="h-5 w-5" />;
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return <Twitter className="h-5 w-5" />;
    if (urlLower.includes('linkedin.com')) return <Linkedin className="h-5 w-5" />;
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return <Youtube className="h-5 w-5" />;
    if (urlLower.includes('tiktok.com')) return <Music2 className="h-5 w-5" />;
    if (urlLower.includes('snapchat.com')) return <Ghost className="h-5 w-5" />;
    if (urlLower.includes('wa.me') || urlLower.includes('whatsapp')) return <MessageCircle className="h-5 w-5" />;
    if (urlLower.includes('signal.me') || urlLower.includes('signal')) return <MessageSquare className="h-5 w-5" />;
    if (urlLower.includes('tel:')) return <PhoneCall className="h-5 w-5" />;
    if (urlLower.includes('mailto:') || urlLower.includes('@')) return <Mail className="h-5 w-5" />;
    return <Globe className="h-5 w-5" />;
  };

  const getSocialColor = (url: string) => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('instagram.com')) return 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400';
    if (urlLower.includes('facebook.com')) return 'bg-blue-600';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'bg-black';
    if (urlLower.includes('linkedin.com')) return 'bg-blue-700';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'bg-red-600';
    if (urlLower.includes('tiktok.com')) return 'bg-black';
    if (urlLower.includes('snapchat.com')) return 'bg-yellow-400';
    if (urlLower.includes('wa.me') || urlLower.includes('whatsapp')) return 'bg-emerald-600';
    if (urlLower.includes('signal.me') || urlLower.includes('signal')) return 'bg-blue-600';
    if (urlLower.includes('tel:')) return 'bg-emerald-600';
    if (urlLower.includes('mailto:') || urlLower.includes('@')) return 'bg-green-600';
    return 'bg-primary';
  };

  const handleBrandingFileSelect = async (file: File, type: 'logo' | 'favicon' | 'cover') => {
    if (!file) return;
    
    // Get current user ID for upload path
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }

    // Use the appropriate upload hook based on type
    if (type === 'logo') {
      await logoUpload.handleFileSelect(file, user.id, `club-${clubId}-logo`);
    } else if (type === 'favicon') {
      await faviconUpload.handleFileSelect(file, user.id, `club-${clubId}-favicon`);
    } else if (type === 'cover') {
      await coverUpload.handleFileSelect(file, user.id, `club-${clubId}-cover`);
    }
  };

  // Bank account functions
  const handleAddBankAccount = async () => {
    if (!newBankAccount.bank_name || !newBankAccount.account_name || !newBankAccount.account_number) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.functions.invoke("bank-accounts", {
      body: {
        action: "create",
        data: {
          club_id: clubId,
          ...newBankAccount,
        },
      },
    });

    if (error) {
      toast({ title: "Error adding bank account", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bank account added successfully" });
      setNewBankAccount({
        bank_name: "",
        account_name: "",
        account_number: "",
        iban: "",
        swift_code: "",
        is_primary: false,
      });
      fetchBankAccounts();
    }
  };

  const handleUpdateBankAccount = async () => {
    if (!editingBankAccount) return;

    const { data, error } = await supabase.functions.invoke("bank-accounts", {
      body: {
        action: "update",
        accountId: editingBankAccount.id,
        data: {
          bank_name: editingBankAccount.bank_name,
          account_name: editingBankAccount.account_name,
          account_number: editingBankAccount.account_number,
          iban: editingBankAccount.iban,
          swift_code: editingBankAccount.swift_code,
          is_primary: editingBankAccount.is_primary,
        },
      },
    });

    if (error) {
      toast({ title: "Error updating bank account", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bank account updated successfully" });
      setEditingBankAccount(null);
      fetchBankAccounts();
    }
  };

  const handleDeleteBankAccount = async (accountId: string) => {
    const { data, error } = await supabase.functions.invoke("bank-accounts", {
      body: {
        action: "delete",
        accountId,
      },
    });

    if (error) {
      toast({ title: "Error deleting bank account", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bank account deleted successfully" });
      fetchBankAccounts();
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Club Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Slogan</Label>
                  <Input
                    value={formData.slogan}
                    onChange={(e) => setFormData(prev => ({ ...prev, slogan: e.target.value }))}
                    placeholder="A catchy tagline for your club"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>First-Time Enrollment Fee ({formData.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.enrollment_fee}
                    onChange={(e) => setFormData(prev => ({ ...prev, enrollment_fee: e.target.value }))}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    One-time fee charged when a new member joins the club
                  </p>
                </div>
                <div>
                  <Label>Commercial Registration Number (Optional)</Label>
                  <Input
                    value={formData.commercial_registration_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, commercial_registration_number: e.target.value }))}
                    placeholder="e.g., CR-123456-01"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Appears on receipts if provided
                  </p>
                </div>
                <div>
                  <Label>VAT Registration Number (Optional)</Label>
                  <Input
                    value={formData.vat_registration_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, vat_registration_number: e.target.value }))}
                    placeholder="e.g., VAT123456789"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Appears on receipts if provided
                  </p>
                </div>
                <div>
                  <Label>VAT Percentage (Optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.vat_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, vat_percentage: e.target.value }))}
                    placeholder="0.00"
                  />
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Tax percentage for financial transactions (e.g., 5 for 5%, 10 for 10%)</p>
                    <p className="font-medium text-primary">⚠️ This VAT rate applies to NEW transactions only. Past transactions preserve their original VAT rate.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Club Contact</h3>
                  <div>
                    <Label>Club Email</Label>
                    <Input
                      type="email"
                      value={formData.club_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, club_email: e.target.value }))}
                      placeholder="info@yourclub.com"
                    />
                  </div>
                  <div>
                    <Label>Club Phone</Label>
                    <PhoneInput
                      countryCode={formData.club_phone_code}
                      phoneNumber={formData.club_phone}
                      onCountryCodeChange={(code) => setFormData(prev => ({ ...prev, club_phone_code: code }))}
                      onPhoneNumberChange={(phone) => setFormData(prev => ({ ...prev, club_phone: phone }))}
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <SearchableSelect
                      value={formData.currency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                      options={currencyOptions}
                      placeholder="Select currency"
                      searchPlaceholder="Search currencies..."
                      emptyMessage="No currency found."
                    />
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <SearchableSelect
                      value={formData.timezone}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                      options={timezoneOptions}
                      placeholder="Select timezone"
                      searchPlaceholder="Search timezones..."
                      emptyMessage="No timezone found."
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <CountrySelector
                      value={formData.country_iso}
                      onValueChange={handleCountryChange}
                      placeholder="Select country"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecting a country will automatically set currency, timezone, and phone code
                    </p>
                  </div>
                  <div>
                    <Label>Club Slug (Unique URL)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.club_slug}
                        onChange={(e) => setFormData(prev => ({ ...prev, club_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        placeholder="e.g., emperor-tkd-academy or eta"
                      />
                      {formData.club_slug && (
                        <Button onClick={generateQRCode} variant="outline" size="icon">
                          <QrCode className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      URL-friendly identifier (lowercase, hyphens, no spaces). Example: "eta" → {formData.country_iso?.toLowerCase() || 'bh'}/eta
                    </p>
                    {formData.club_slug && formData.country_iso ? (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm font-medium">Club URL:</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1 text-sm bg-muted p-2 rounded">
                            <span className="text-muted-foreground">{window.location.origin}/club/</span>
                            <span className="font-mono text-primary">{formData.country_iso.toLowerCase()}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-mono text-primary">{formData.club_slug}</span>
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/club/${formData.country_iso.toLowerCase()}/${formData.club_slug}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: "URL copied!", description: "Club URL copied to clipboard" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/club/${formData.country_iso.toLowerCase()}/${formData.club_slug}`;
                              window.open(url, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-green-600">✓ URL is ready to use</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        ⚠ Fill both Country Code and Club Slug to see URL
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Owner Information</h3>
                    {(!formData.owner_name || !formData.owner_email || !formData.owner_contact) && (
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <User className="w-4 h-4 mr-2" />
                              Create Owner
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Create New Owner</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <Label>Full Name *</Label>
                                <Input
                                  value={formData.owner_name}
                                  onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                                  placeholder="John Doe"
                                />
                              </div>
                              <div>
                                <Label>Email *</Label>
                                <Input
                                  type="email"
                                  value={formData.owner_email}
                                  onChange={(e) => setFormData(prev => ({ ...prev, owner_email: e.target.value }))}
                                  placeholder="owner@email.com"
                                />
                              </div>
                              <div>
                                <Label>Phone *</Label>
                                <PhoneInput
                                  countryCode={formData.owner_contact_code}
                                  phoneNumber={formData.owner_contact}
                                  onCountryCodeChange={(code) => setFormData(prev => ({ ...prev, owner_contact_code: code }))}
                                  onPhoneNumberChange={(phone) => setFormData(prev => ({ ...prev, owner_contact: phone }))}
                                />
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                  This will create a new profile, assign admin role, and add them as a club member with "Owner" rank.
                                </p>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleUpdateClub}>Create Owner</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <User className="w-4 h-4 mr-2" />
                              Link Owner
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md max-h-[600px]">
                            <DialogHeader>
                              <DialogTitle>Link Existing Member as Owner</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <Label>Search Member</Label>
                                <Input
                                  placeholder="Search by name, email, or phone..."
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    handleSearchMembers(e.target.value);
                                  }}
                                />
                              </div>
                              
                              {searchResults.length > 0 && (
                                <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2">
                                  {searchResults.map((member) => (
                                    <button
                                      key={member.user_id}
                                      onClick={() => handleLinkOwner(member)}
                                      className="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors"
                                    >
                                      <p className="font-medium">{member.name}</p>
                                      {member.email && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          {member.email}
                                        </p>
                                      )}
                                      {member.phone && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                          <Phone className="w-3 h-3" />
                                          {member.country_code} {member.phone}
                                        </p>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              {searchQuery.length >= 2 && searchResults.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                  <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No members found</p>
                                </div>
                              )}
                              
                              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  Search for an existing platform member to link as club owner. They'll be assigned admin role and added as a club member with "Owner" rank.
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </div>
                  
                  {formData.owner_name && formData.owner_email && formData.owner_contact ? (
                    <div className="bg-card border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{formData.owner_name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {formData.owner_email}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {formData.owner_contact_code} {formData.owner_contact}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              owner_name: "",
                              owner_email: "",
                              owner_contact: "",
                              owner_contact_code: "+1"
                            }));
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <User className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No owner assigned yet. Create a new owner or link an existing member.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="location" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Location & GPS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Address</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    <MapPin className="inline w-4 h-4 mr-1" />
                    GPS Latitude
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.gps_latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, gps_latitude: e.target.value }))}
                    placeholder="e.g., 25.2048"
                  />
                </div>
                <div>
                  <Label>
                    <MapPin className="inline w-4 h-4 mr-1" />
                    GPS Longitude
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.gps_longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, gps_longitude: e.target.value }))}
                    placeholder="e.g., 55.2708"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Interactive Map (Drag marker to set location)</Label>
                <div className="h-[400px] rounded-lg overflow-hidden border">
                  <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Map failed to load</div>}>
                    <LeafletLocationMap
                      latitude={formData.gps_latitude ? parseFloat(formData.gps_latitude) : undefined}
                      longitude={formData.gps_longitude ? parseFloat(formData.gps_longitude) : undefined}
                      zoom={formData.map_zoom ? parseInt(formData.map_zoom) : 13}
                      onLocationChange={(lat, lng) => {
                        setFormData(prev => ({
                          ...prev,
                          gps_latitude: lat.toString(),
                          gps_longitude: lng.toString(),
                        }));
                      }}
                      onZoomChange={(zoom) => {
                        setFormData(prev => ({
                          ...prev,
                          map_zoom: zoom.toString(),
                        }));
                      }}
                      onAddressChange={(address) => {
                        setFormData(prev => ({
                          ...prev,
                          location: address,
                        }));
                      }}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Logo</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBrandingFileSelect(file, 'logo');
                    }}
                    disabled={logoUpload.isUploading}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={logoUpload.isUploading}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                {formData.logo_url && (
                  <img src={formData.logo_url} alt="Logo preview" className="mt-2 h-20 object-contain" />
                )}
              </div>
              <div>
                <Label>Favicon</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBrandingFileSelect(file, 'favicon');
                    }}
                    disabled={faviconUpload.isUploading}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={faviconUpload.isUploading}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                {formData.favicon_url && (
                  <img src={formData.favicon_url} alt="Favicon preview" className="mt-2 h-8 w-8 object-contain" />
                )}
              </div>
              <div>
                <Label>Cover Image</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBrandingFileSelect(file, 'cover');
                    }}
                    disabled={coverUpload.isUploading}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={coverUpload.isUploading}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                {formData.image_url && (
                  <div className="mt-2">
                    <img src={formData.image_url} alt="Cover preview" className="max-w-[300px] w-full h-auto object-contain rounded" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Social Media Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Links Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {linkTree.map((link, index) => (
                  <div 
                    key={index} 
                    className="group relative border-2 rounded-lg hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-card overflow-hidden"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        openExternalLink(link.url);
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-accent/5 transition-colors text-left cursor-pointer"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full ${getSocialColor(link.url)} text-white shadow-lg flex-shrink-0`}>
                        {getSocialIcon(link.url)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm mb-1">{link.title}</p>
                        <p className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1">
                          {link.url}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </p>
                      </div>
                    </button>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-primary/10 hover:text-primary z-10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditLink(index);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-destructive/10 hover:text-destructive z-10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeLinkFromTree(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Link Button */}
              {linkTree.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground mb-4">No social media links added yet</p>
                  <Dialog open={isAddLinkDialogOpen} onOpenChange={setIsAddLinkDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Social Media Link
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Social Media Link</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Select Platform</Label>
                          <Select value={selectedPlatform} onValueChange={handlePlatformSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a platform..." />
                            </SelectTrigger>
                            <SelectContent>
                              {SOCIAL_PLATFORMS.map((platform) => {
                                const Icon = platform.icon;
                                return (
                                  <SelectItem key={platform.name} value={platform.name}>
                                    <div className="flex items-center gap-3">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${platform.color} text-white`}>
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <span>{platform.name}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedPlatform && (
                          <>
                            <div>
                              <Label>Platform Name</Label>
                              <Input
                                placeholder="e.g., Instagram, Facebook"
                                value={newLink.title}
                                onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Link URL</Label>
                              <Input
                                placeholder="https://..."
                                value={newLink.url}
                                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setIsAddLinkDialogOpen(false);
                          setSelectedPlatform("");
                          setNewLink({ title: "", url: "" });
                        }}>
                          Cancel
                        </Button>
                        <Button onClick={addLinkToTree} disabled={!newLink.title || !newLink.url}>
                          Add Link
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <Dialog open={isAddLinkDialogOpen} onOpenChange={setIsAddLinkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Social Media Link
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Social Media Link</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Select Platform</Label>
                        <Select value={selectedPlatform} onValueChange={handlePlatformSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a platform..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SOCIAL_PLATFORMS.map((platform) => {
                              const Icon = platform.icon;
                              return (
                                <SelectItem key={platform.name} value={platform.name}>
                                  <div className="flex items-center gap-3">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${platform.color} text-white`}>
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <span>{platform.name}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPlatform && (
                        <>
                          <div>
                            <Label>Platform Name</Label>
                            <Input
                              placeholder="e.g., Instagram, Facebook"
                              value={newLink.title}
                              onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Link URL</Label>
                            <Input
                              placeholder="https://..."
                              value={newLink.url}
                              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsAddLinkDialogOpen(false);
                        setSelectedPlatform("");
                        setNewLink({ title: "", url: "" });
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={addLinkToTree} disabled={!newLink.title || !newLink.url}>
                        Add Link
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Edit Link Dialog */}
              <Dialog open={isEditLinkDialogOpen} onOpenChange={setIsEditLinkDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Social Media Link</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Platform Name</Label>
                      <Input
                        placeholder="e.g., Instagram, Facebook"
                        value={editLink.title}
                        onChange={(e) => setEditLink({ ...editLink, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Link URL</Label>
                      <Input
                        placeholder="https://..."
                        value={editLink.url}
                        onChange={(e) => setEditLink({ ...editLink, url: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIsEditLinkDialogOpen(false);
                      setEditingLinkIndex(null);
                      setEditLink({ title: "", url: "" });
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={saveEditedLink} disabled={!editLink.title || !editLink.url}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Bank Accounts (Encrypted)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Bank Accounts */}
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <Card 
                    key={account.id} 
                    className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                  >
                    <CardContent className="pt-6">
                      {editingBankAccount?.id === account.id ? (
                        <div className="space-y-4">
                          <div>
                            <Label>Bank Name *</Label>
                            <Input
                              value={editingBankAccount.bank_name}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, bank_name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Account Name *</Label>
                            <Input
                              value={editingBankAccount.account_name}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, account_name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Account Number *</Label>
                            <Input
                              value={editingBankAccount.account_number}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, account_number: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>IBAN</Label>
                            <Input
                              value={editingBankAccount.iban || ""}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, iban: e.target.value })
                              }
                              placeholder="e.g., AE07 0331 2345 6789 0123 456"
                            />
                          </div>
                          <div>
                            <Label>SWIFT/BIC Code</Label>
                            <Input
                              value={editingBankAccount.swift_code || ""}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, swift_code: e.target.value })
                              }
                              placeholder="e.g., BOMLAEAD"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editingBankAccount.is_primary}
                              onChange={(e) =>
                                setEditingBankAccount({ ...editingBankAccount, is_primary: e.target.checked })
                              }
                              className="rounded"
                            />
                            <Label>Primary Account</Label>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleUpdateBankAccount}>Save</Button>
                            <Button variant="outline" onClick={() => setEditingBankAccount(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Header with Bank Name and Actions */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="p-3 rounded-full bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold">{account.bank_name}</h3>
                                {account.is_primary && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-3 py-1 rounded-full mt-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    Primary Account
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="hover:bg-primary/10"
                                onClick={() => setEditingBankAccount(account)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="hover:bg-destructive/10 text-destructive"
                                onClick={() => handleDeleteBankAccount(account.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          {/* Account Details Grid */}
                          <div className="grid gap-3 pt-2 border-t">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="p-2 rounded-md bg-background">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium">Account Holder</p>
                                <p className="text-sm font-semibold">{account.account_name}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="p-2 rounded-md bg-background">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium">Account Number</p>
                                <p className="text-sm font-mono font-semibold">{account.account_number}</p>
                              </div>
                            </div>

                            {account.iban && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="p-2 rounded-md bg-background">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground font-medium">IBAN</p>
                                  <p className="text-sm font-mono font-semibold">{account.iban}</p>
                                </div>
                              </div>
                            )}

                            {account.swift_code && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="p-2 rounded-md bg-background">
                                  <Code className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground font-medium">SWIFT/BIC Code</p>
                                  <p className="text-sm font-mono font-semibold">{account.swift_code}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Security Badge */}
                          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                            <Shield className="h-3.5 w-3.5" />
                            <span>All sensitive data is encrypted using AES-256</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Add New Bank Account */}
              <Card className="border-dashed border-2">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Add New Bank Account</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Bank Name *</Label>
                      <Input
                        value={newBankAccount.bank_name}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, bank_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Account Name *</Label>
                      <Input
                        value={newBankAccount.account_name}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, account_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Account Number *</Label>
                      <Input
                        value={newBankAccount.account_number}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, account_number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>IBAN</Label>
                      <Input
                        value={newBankAccount.iban}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, iban: e.target.value })
                        }
                        placeholder="e.g., AE07 0331 2345 6789 0123 456"
                      />
                    </div>
                    <div>
                      <Label>SWIFT/BIC Code</Label>
                      <Input
                        value={newBankAccount.swift_code}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, swift_code: e.target.value })
                        }
                        placeholder="e.g., BOMLAEAD"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newBankAccount.is_primary}
                        onChange={(e) =>
                          setNewBankAccount({ ...newBankAccount, is_primary: e.target.checked })
                        }
                        className="rounded"
                      />
                      <Label>Primary Account</Label>
                    </div>
                    <Button onClick={handleAddBankAccount}>Add Bank Account</Button>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Prefixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Member Code Prefix</Label>
                  <Input
                    value={formData.member_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, member_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="MEM"
                  />
                </div>
                <div>
                  <Label>Child Code Prefix</Label>
                  <Input
                    value={formData.child_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, child_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="CHILD"
                  />
                  <p className="text-xs text-muted-foreground mt-1">For children of members becoming members</p>
                </div>
                <div>
                  <Label>Invoice Code Prefix</Label>
                  <Input
                    value={formData.invoice_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoice_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="INV"
                  />
                </div>
                <div>
                  <Label>Receipt Code Prefix</Label>
                  <Input
                    value={formData.receipt_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, receipt_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="REC"
                  />
                </div>
                <div>
                  <Label>Expense Code Prefix</Label>
                  <Input
                    value={formData.expense_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, expense_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="EXP"
                  />
                </div>
                <div>
                  <Label>Specialist Code Prefix</Label>
                  <Input
                    value={formData.specialist_code_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialist_code_prefix: e.target.value.toUpperCase() }))}
                    placeholder="SPEC"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Once you delete a club, there is no going back. This action will permanently delete:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                  <li>All club information and settings</li>
                  <li>All facilities, instructors, and activities</li>
                  <li>All packages, memberships, and member data</li>
                  <li>All uploaded images and files from storage</li>
                  <li>All reviews, statistics, and historical data</li>
                </ul>
                <div className="pt-4 border-t">
                  <DeleteClubDialog clubId={clubId} clubName={formData.name} onClubDeleted={onClubDeleted} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleUpdateClub} disabled={!dataLoaded || loading}>
          {loading ? "Saving..." : "Save All Changes"}
        </Button>
      </div>

      {/* Image Croppers */}
      {logoUpload.imageToEdit && (
        <ImageCropper
          image={logoUpload.imageToEdit}
          aspectRatioType="square"
          maxOutputSize={1024}
          onCropComplete={logoUpload.handleCropComplete}
          onClose={logoUpload.handleCloseCropper}
        />
      )}

      {faviconUpload.imageToEdit && (
        <ImageCropper
          image={faviconUpload.imageToEdit}
          aspectRatioType="square"
          maxOutputSize={512}
          onCropComplete={faviconUpload.handleCropComplete}
          onClose={faviconUpload.handleCloseCropper}
        />
      )}

      {coverUpload.imageToEdit && (
        <ImageCropper
          image={coverUpload.imageToEdit}
          aspectRatioType="cover"
          maxOutputSize={1920}
          onCropComplete={coverUpload.handleCropComplete}
          onClose={coverUpload.handleCloseCropper}
        />
      )}
    </div>
  );
};
