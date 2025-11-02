import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus, DollarSign, Calendar, Package, Tag, Users, ChevronLeft, ChevronRight, Upload, Clock, Activity, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerField } from "@/components/form/DatePickerField";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropper } from "@/components/ImageCropper";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AdminPackagesProps {
  clubId: string;
  clubCurrency: string;
  onUpdate?: () => void;
}

const formatCurrency = (amount: number | string, currency: string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const hasDecimals = numAmount % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(numAmount);
};

const formatTimeTo12Hour = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const AdminPackages: React.FC<AdminPackagesProps> = ({ clubId, clubCurrency, onUpdate }) => {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [activityInstructors, setActivityInstructors] = useState<Record<string, string[]>>({});
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_months: "",
    picture_url: "",
    activity_type: "single",
    gender_restriction: "mixed",
    is_popular: false,
    discount_code: "",
    discount_percentage: "",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    age_min: "",
    age_max: "",
  });

  const {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "rectangle",
    maxOutputSize: 1200,
    bucket: "avatars",
    onSuccess: (url) => {
      setFormData(prev => ({ ...prev, picture_url: url }));
    }
  });

  useEffect(() => {
    fetchPackages();
    fetchActivities();
    fetchInstructors();
  }, [clubId]);

  // Automatically set activity_type based on selected activities
  useEffect(() => {
    if (selectedActivities.length > 1) {
      setFormData(prev => ({ ...prev, activity_type: "multiple" }));
    } else if (selectedActivities.length === 1) {
      setFormData(prev => ({ ...prev, activity_type: "single" }));
    }
  }, [selectedActivities]);

  const fetchPackages = async () => {
    const { data } = await supabase
      .from("club_packages")
      .select(`
        *,
        package_activities(
          activity_id,
          class_id,
          instructor_id,
          activities(
            id, 
            title, 
            picture_url,
            duration_minutes,
            activity_schedules(
              day_of_week,
              start_time,
              end_time
            )
          ),
          club_instructors(
            id,
            name,
            image_url
          )
        )
      `)
      .eq("club_id", clubId)
      .order("name");
    setPackages(data || []);
  };

  const fetchActivities = async () => {
    const { data } = await supabase
      .from("activities")
      .select(`
        id, 
        title,
        picture_url,
        activity_schedules(
          day_of_week,
          start_time,
          end_time
        )
      `)
      .eq("club_id", clubId)
      .order("title");
    setActivities(data || []);
  };

  const fetchInstructors = async () => {
    const { data } = await supabase
      .from("club_instructors")
      .select("id, name")
      .eq("club_id", clubId)
      .order("name");
    setInstructors(data || []);
  };

  const fetchPackageActivities = async (packageId: string) => {
    const { data, error } = await supabase
      .from("package_activities")
      .select("activity_id")
      .eq("package_id", packageId);
    if (error) {
      console.error("Error loading package activities", error);
    }
    setSelectedActivities((data || []).map(pa => pa.activity_id).filter(Boolean));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      duration_months: "",
      picture_url: "",
      activity_type: "single",
      gender_restriction: "mixed",
      is_popular: false,
      discount_code: "",
      discount_percentage: "",
      start_date: undefined,
      end_date: undefined,
      age_min: "",
      age_max: "",
    });
    setEditingItem(null);
    setSelectedActivities([]);
    setActivityInstructors({});
  };

  const handleEdit = async (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price?.toString() || "",
      duration_months: item.duration_months?.toString() || "",
      picture_url: item.picture_url || "",
      activity_type: item.activity_type || "single",
      gender_restriction: item.gender_restriction || "mixed",
      is_popular: item.is_popular || false,
      discount_code: item.discount_code || "",
      discount_percentage: item.discount_percentage?.toString() || "",
      start_date: item.start_date ? new Date(item.start_date) : undefined,
      end_date: item.end_date ? new Date(item.end_date) : undefined,
      age_min: item.age_min?.toString() || "",
      age_max: item.age_max?.toString() || "",
    });
    
    // Load existing activity-instructor mappings (multiple instructors per activity)
    const { data: packageActivities } = await supabase
      .from("package_activities")
      .select("activity_id, instructor_id")
      .eq("package_id", item.id);
    
    if (packageActivities) {
      const instructorMap: Record<string, string[]> = {};
      packageActivities.forEach(pa => {
        if (pa.activity_id && pa.instructor_id) {
          if (!instructorMap[pa.activity_id]) {
            instructorMap[pa.activity_id] = [];
          }
          instructorMap[pa.activity_id].push(pa.instructor_id);
        }
      });
      setActivityInstructors(instructorMap);
    }
    
    await fetchPackageActivities(item.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const missingFields = [];
    if (!formData.name) missingFields.push("Package Name");
    if (!formData.price) missingFields.push("Price");
    if (!formData.duration_months) missingFields.push("Duration");
    
    if (missingFields.length > 0) {
      toast({ 
        title: "Required fields missing", 
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive" 
      });
      return;
    }

    const payload = {
      club_id: clubId,
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      duration_months: parseInt(formData.duration_months),
      picture_url: formData.picture_url || null,
      activity_type: formData.activity_type,
      gender_restriction: formData.gender_restriction,
      is_popular: formData.is_popular,
      discount_code: formData.discount_code || null,
      discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : 0,
      start_date: formData.start_date ? format(formData.start_date, "yyyy-MM-dd") : null,
      end_date: formData.end_date ? format(formData.end_date, "yyyy-MM-dd") : null,
      age_min: formData.age_min ? parseInt(formData.age_min) : null,
      age_max: formData.age_max ? parseInt(formData.age_max) : null,
    };

    if (editingItem) {
      const { error } = await supabase.from("club_packages").update(payload).eq("id", editingItem.id);
      if (error) {
        toast({ title: "Error updating package", description: error.message, variant: "destructive" });
        return;
      }
      
      // Update package activities - delete existing first
      const { error: deleteError } = await supabase
        .from("package_activities")
        .delete()
        .eq("package_id", editingItem.id);
      
      if (deleteError) {
        console.error("Error deleting package activities:", deleteError);
        toast({ 
          title: "Warning", 
          description: "Could not remove old activities. Package may have duplicate entries.", 
          variant: "destructive" 
        });
      }
      
      await savePackageActivities(editingItem.id);
      
      toast({ title: "Package updated successfully" });
      fetchPackages();
      setIsDialogOpen(false);
      resetForm();
    } else {
      const { data, error } = await supabase.from("club_packages").insert(payload).select().single();
      if (error) {
        toast({ title: "Error creating package", description: error.message, variant: "destructive" });
        return;
      }
      
      if (data) {
        await savePackageActivities(data.id);
      }
      
      toast({ title: "Package created successfully" });
      fetchPackages();
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const savePackageActivities = async (packageId: string) => {
    const activityInserts: any[] = [];
    
    selectedActivities.forEach(activityId => {
      const instructorIds = activityInstructors[activityId] || [];
      
      if (instructorIds.length > 0) {
        // Create one row per unique instructor (avoid duplicates in the array)
        const uniqueInstructorIds = [...new Set(instructorIds)];
        uniqueInstructorIds.forEach(instructorId => {
          activityInserts.push({
            package_id: packageId,
            activity_id: activityId,
            class_id: null,
            instructor_id: instructorId,
          });
        });
      } else {
        // No instructors assigned
        activityInserts.push({
          package_id: packageId,
          activity_id: activityId,
          class_id: null,
          instructor_id: null,
        });
      }
    });

    if (activityInserts.length > 0) {
      console.log('Inserting package activities:', activityInserts);
      const { error } = await supabase.from("package_activities").insert(activityInserts);
      if (error) {
        console.error('Error saving package activities:', error);
        toast({ 
          title: "Warning", 
          description: "Package saved but activities may not be linked correctly", 
          variant: "destructive" 
        });
      }
    }
  };

  const checkScheduleConflict = (activityId: string, selectedIds: string[]): boolean => {
    const newActivity = activities.find(a => a.id === activityId);
    if (!newActivity?.activity_schedules || newActivity.activity_schedules.length === 0) {
      return false;
    }

    for (const selectedId of selectedIds) {
      const selectedActivity = activities.find(a => a.id === selectedId);
      if (!selectedActivity?.activity_schedules) continue;

      for (const newSchedule of newActivity.activity_schedules) {
        for (const selectedSchedule of selectedActivity.activity_schedules) {
          if (newSchedule.day_of_week === selectedSchedule.day_of_week) {
            const newStart = newSchedule.start_time;
            const newEnd = newSchedule.end_time;
            const selectedStart = selectedSchedule.start_time;
            const selectedEnd = selectedSchedule.end_time;

            if (
              (newStart >= selectedStart && newStart < selectedEnd) ||
              (newEnd > selectedStart && newEnd <= selectedEnd) ||
              (newStart <= selectedStart && newEnd >= selectedEnd)
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const toggleActivity = (activityId: string) => {
    setSelectedActivities(prev => {
      if (prev.includes(activityId)) {
        return prev.filter(id => id !== activityId);
      } else {
        if (checkScheduleConflict(activityId, prev)) {
          toast({
            title: "Schedule Conflict",
            description: "This activity conflicts with an already selected activity's schedule.",
            variant: "destructive"
          });
          return prev;
        }
        return [...prev, activityId];
      }
    });
  };

  const handleDuplicate = async (item: any) => {
    // Set form data with duplicated package info (add "Copy" to name)
    setFormData({
      name: `${item.name} (Copy)`,
      description: item.description || "",
      price: item.price?.toString() || "",
      duration_months: item.duration_months?.toString() || "",
      picture_url: item.picture_url || "",
      activity_type: item.activity_type || "single",
      gender_restriction: item.gender_restriction || "mixed",
      is_popular: false, // Don't duplicate popular status
      discount_code: "",
      discount_percentage: "",
      start_date: item.start_date ? new Date(item.start_date) : undefined,
      end_date: item.end_date ? new Date(item.end_date) : undefined,
      age_min: item.age_min?.toString() || "",
      age_max: item.age_max?.toString() || "",
    });
    
    // Load existing activity-instructor mappings (multiple instructors per activity)
    const { data: packageActivities } = await supabase
      .from("package_activities")
      .select("activity_id, instructor_id")
      .eq("package_id", item.id);
    
    if (packageActivities) {
      const instructorMap: Record<string, string[]> = {};
      packageActivities.forEach(pa => {
        if (pa.activity_id && pa.instructor_id) {
          if (!instructorMap[pa.activity_id]) {
            instructorMap[pa.activity_id] = [];
          }
          instructorMap[pa.activity_id].push(pa.instructor_id);
        }
      });
      setActivityInstructors(instructorMap);
    }
    
    // Load the activities
    await fetchPackageActivities(item.id);
    setEditingItem(null); // Not editing, creating new
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will also remove all linked activities.")) return;
    const { error } = await supabase.from("club_packages").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting package", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Package deleted successfully" });
      fetchPackages();
      onUpdate?.();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h2 className="text-2xl font-bold">Packages Management</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1 pb-4 border-b">
              <DialogTitle className="text-2xl">{editingItem ? "Edit Package" : "Create New Package"}</DialogTitle>
              <p className="text-sm text-muted-foreground">Configure your membership package with activities, pricing, and availability</p>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full mt-6">
              <TabsList className="grid w-full grid-cols-3 h-12">
                <TabsTrigger value="basic" className="text-base">Basic Info</TabsTrigger>
                <TabsTrigger value="activities" className="text-base">Activities</TabsTrigger>
                <TabsTrigger value="pricing" className="text-base">Pricing</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6 mt-6">
                {/* Package Image Section */}
                <Card className="overflow-hidden">
                  <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Upload className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Package Image</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        {formData.picture_url ? (
                          <div className="relative w-full group">
                            <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border-2 border-primary/20 bg-muted/30 shadow-lg">
                              <img 
                                src={formData.picture_url} 
                                alt="Package preview" 
                                className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
                              />
                            </div>
                            <Badge variant="secondary" className="absolute top-2 right-2">16:9</Badge>
                          </div>
                        ) : (
                          <div className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No image uploaded</p>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  handleFileSelect(file, 'package', `${Date.now()}`);
                                }
                              };
                              input.click();
                            }}
                            disabled={isUploading}
                            className="flex-1"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {isUploading ? 'Uploading...' : formData.picture_url ? 'Change' : 'Upload'}
                          </Button>
                          {formData.picture_url && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setFormData(prev => ({ ...prev, picture_url: '' }))}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <p className="text-sm font-medium">Image Guidelines</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-primary"></div>
                              Recommended ratio: 16:9
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-primary"></div>
                              Maximum file size: 5MB
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-primary"></div>
                              Formats: JPG, PNG, WebP
                            </li>
                          </ul>
                        </div>
                        
                        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card">
                          <Switch
                            id="popular"
                            checked={formData.is_popular}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
                          />
                          <div className="space-y-0.5">
                            <Label htmlFor="popular" className="cursor-pointer font-medium">Featured Package</Label>
                            <p className="text-xs text-muted-foreground">Highlight this package on the main page</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Package Details Section */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Tag className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Package Details</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-sm font-medium">Package Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Premium Monthly Membership"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="duration" className="text-sm font-medium">Duration (Months) *</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={formData.duration_months}
                            onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                            placeholder="1"
                            className="h-11"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description of what this package includes..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Restrictions Section */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Member Restrictions</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gender" className="text-sm font-medium">Gender</Label>
                        <Select value={formData.gender_restriction} onValueChange={(value) => setFormData({ ...formData, gender_restriction: value })}>
                          <SelectTrigger id="gender" className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mixed">Mixed (All Genders)</SelectItem>
                            <SelectItem value="male">Male Only</SelectItem>
                            <SelectItem value="female">Female Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="age_min" className="text-sm font-medium">Minimum Age</Label>
                        <Input
                          id="age_min"
                          type="number"
                          value={formData.age_min}
                          onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                          placeholder="e.g., 5"
                          min="0"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="age_max" className="text-sm font-medium">Maximum Age</Label>
                        <Input
                          id="age_max"
                          type="number"
                          value={formData.age_max}
                          onChange={(e) => setFormData({ ...formData, age_max: e.target.value })}
                          placeholder="e.g., 18"
                          min="0"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Availability Section */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Availability Period</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Start Date</Label>
                        <DatePickerField
                          value={formData.start_date}
                          onSelect={(date) => setFormData({ ...formData, start_date: date })}
                          placeholder="Select start date"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">End Date</Label>
                        <DatePickerField
                          value={formData.end_date}
                          onSelect={(date) => setFormData({ ...formData, end_date: date })}
                          placeholder="Select end date"
                          disabled={(date) => formData.start_date ? date < formData.start_date : false}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="space-y-4 mt-6">
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Included Activities</h3>
                        <p className="text-sm text-muted-foreground">
                          Select activities and assign trainers for this package
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {activities.map((activity) => {
                        const hasConflict = !selectedActivities.includes(activity.id) && 
                          checkScheduleConflict(activity.id, selectedActivities);
                        const isSelected = selectedActivities.includes(activity.id);
                        
                        return (
                          <div 
                            key={activity.id} 
                            className={cn(
                              "p-4 rounded-lg border-2 transition-all",
                              isSelected && "border-primary bg-primary/5",
                              !isSelected && "border-muted hover:border-muted-foreground/50",
                              hasConflict && "opacity-50 bg-muted cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <Checkbox
                                id={`activity-${activity.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleActivity(activity.id)}
                                disabled={hasConflict}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-3">
                                <div>
                                  <label
                                    htmlFor={`activity-${activity.id}`}
                                    className={cn(
                                      "text-base font-medium flex items-center gap-2",
                                      hasConflict ? "cursor-not-allowed" : "cursor-pointer"
                                    )}
                                  >
                                    {activity.title}
                                    {hasConflict && (
                                      <Badge variant="destructive" className="text-xs">
                                        Schedule Conflict
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <Badge variant="default" className="text-xs">
                                        Included
                                      </Badge>
                                    )}
                                  </label>
                                   {activity.activity_schedules && activity.activity_schedules.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {activity.activity_schedules.map((schedule: any, idx: number) => (
                                        <Badge key={idx} variant="outline" className="text-xs font-normal capitalize">
                                          <Clock className="w-3 h-3 mr-1" />
                                          {schedule.day_of_week}: {formatTimeTo12Hour(schedule.start_time)} - {formatTimeTo12Hour(schedule.end_time)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {isSelected && (
                                  <div className="space-y-3 pt-3 border-t">
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="w-4 h-4 text-muted-foreground" />
                                      <Label className="text-sm font-medium">Trainers</Label>
                                    </div>
                                    
                                    {/* Selected trainers as badges */}
                                    {activityInstructors[activity.id] && activityInstructors[activity.id].length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {activityInstructors[activity.id].map(instructorId => {
                                          const instructor = instructors.find(i => i.id === instructorId);
                                          return instructor ? (
                                            <Badge 
                                              key={instructorId}
                                              variant="secondary"
                                              className="gap-1 pr-1"
                                            >
                                              {instructor.name}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-4 w-4 p-0 hover:bg-destructive/20"
                                                onClick={() => {
                                                  setActivityInstructors(prev => ({
                                                    ...prev,
                                                    [activity.id]: prev[activity.id].filter(id => id !== instructorId)
                                                  }));
                                                }}
                                              >
                                                ×
                                              </Button>
                                            </Badge>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                    
                                    {/* Checkboxes for trainer selection */}
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                      {instructors.map((instructor) => {
                                        const isAssigned = activityInstructors[activity.id]?.includes(instructor.id);
                                        return (
                                          <div key={instructor.id} className="flex items-center gap-2">
                                            <Checkbox
                                              id={`instructor-${activity.id}-${instructor.id}`}
                                              checked={isAssigned}
                                              onCheckedChange={(checked) => {
                                                setActivityInstructors(prev => {
                                                  const current = prev[activity.id] || [];
                                                  if (checked) {
                                                    return {
                                                      ...prev,
                                                      [activity.id]: [...current, instructor.id]
                                                    };
                                                  } else {
                                                    const filtered = current.filter(id => id !== instructor.id);
                                                    if (filtered.length === 0) {
                                                      const updated = { ...prev };
                                                      delete updated[activity.id];
                                                      return updated;
                                                    }
                                                    return {
                                                      ...prev,
                                                      [activity.id]: filtered
                                                    };
                                                  }
                                                });
                                              }}
                                            />
                                            <Label
                                              htmlFor={`instructor-${activity.id}-${instructor.id}`}
                                              className="text-sm cursor-pointer flex-1"
                                            >
                                              {instructor.name}
                                            </Label>
                                          </div>
                                        );
                                      })}
                                      {instructors.length === 0 && (
                                        <p className="text-xs text-muted-foreground">No trainers available</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {activities.length === 0 && (
                        <div className="text-center py-12">
                          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">No activities available.</p>
                          <p className="text-xs text-muted-foreground">Create activities first to add them to packages.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-6 mt-6">
                {/* Base Price Section */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Base Price</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="price" className="text-sm font-medium">
                        Package Price ({clubCurrency}) *
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="199.99"
                          className="pl-10 h-12 text-lg"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Discount Section */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Tag className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Discount Options</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="discount_code" className="text-sm font-medium">
                          Discount Code
                        </Label>
                        <Input
                          id="discount_code"
                          value={formData.discount_code}
                          onChange={(e) => setFormData({ ...formData, discount_code: e.target.value.toUpperCase() })}
                          placeholder="e.g., SAVE20"
                          className="h-11 font-mono"
                        />
                        <p className="text-xs text-muted-foreground">Optional promo code for customers</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="discount_percentage" className="text-sm font-medium">
                          Discount Percentage
                        </Label>
                        <div className="relative">
                          <Input
                            id="discount_percentage"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={formData.discount_percentage}
                            onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                            placeholder="20"
                            className="h-11 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Percentage off the base price</p>
                      </div>
                    </div>

                    {formData.discount_percentage && formData.price && (
                      <div className="mt-6 p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border-2 border-primary/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Final Price</p>
                            <p className="text-4xl font-bold text-primary">
                              {formatCurrency(parseFloat(formData.price) * (1 - parseFloat(formData.discount_percentage) / 100), clubCurrency)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground line-through">
                              {formatCurrency(parseFloat(formData.price), clubCurrency)}
                            </p>
                            <Badge variant="default" className="mt-2">
                              {formData.discount_percentage}% OFF
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleSubmit}
                className="min-w-[140px]"
              >
                {editingItem ? "Update Package" : "Create Package"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((item) => {
          const activityPictures = item.package_activities
            ?.map((pa: any) => pa.activities?.picture_url)
            .filter((url: string) => url);
          
          // Combine package picture (first) with activity pictures
          const allPictures = [
            ...(item.picture_url ? [item.picture_url] : []),
            ...(activityPictures || [])
          ];

          const getDayAbbr = (day: string) => {
            const days: Record<string, string> = {
              monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
              thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
            };
            return days[day.toLowerCase()] || day;
          };

          const formatTime = (time: string) => {
            if (!time) return '';
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
          };

          const groupSchedulesByTime = (schedules: any[]) => {
            const timeGroups: Record<string, string[]> = {};
            const dayOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            
            schedules.forEach(schedule => {
              const timeKey = `${schedule.start_time}-${schedule.end_time}`;
              if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = [];
              }
              timeGroups[timeKey].push(getDayAbbr(schedule.day_of_week));
            });

            return Object.entries(timeGroups).map(([timeKey, days]) => {
              const [startTime, endTime] = timeKey.split('-');
              const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
              return {
                days: sortedDays.join(', '),
                startTime: formatTime(startTime),
                endTime: formatTime(endTime)
              };
            });
          };

          return (
            <Card key={item.id} className={cn(
              "overflow-hidden transition-all hover:shadow-lg flex flex-col",
              item.is_popular && "border-primary border-2"
            )}>
              {/* Image Carousel */}
              {allPictures.length > 0 && (
                <div className="relative">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {allPictures.map((picture: string, idx: number) => (
                        <CarouselItem key={idx}>
                          <div className="w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-muted/30">
                            <img
                              src={picture}
                              alt={idx === 0 && item.picture_url ? item.name : `Activity ${idx + 1}`}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {allPictures.length > 1 && (
                      <>
                        <CarouselPrevious className="left-2" />
                        <CarouselNext className="right-2" />
                      </>
                    )}
                  </Carousel>
                  {item.is_popular && (
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-primary text-primary-foreground">
                        ⭐ Popular
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Package Details */}
              <div className="flex-1 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2">{item.name}</h3>
                      
                      {/* Package Description */}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge variant={item.activity_type === "single" ? "secondary" : "default"} className="text-xs font-medium">
                          {item.activity_type === "single" ? "Single Activity" : "Multi-Activity"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {item.gender_restriction === "mixed" ? "Mixed" : 
                           item.gender_restriction === "male" ? "Male" : "Female"}
                        </Badge>
                        {(item.age_min || item.age_max) && (
                          <Badge variant="outline" className="text-xs">
                            {item.age_min || 0}-{item.age_max || "∞"}y
                          </Badge>
                        )}
                        {item.discount_code && (
                          <Badge variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {item.discount_code}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDuplicate(item)}>
                        <Package className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Price and Duration */}
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(item.price, clubCurrency)}
                      </span>
                      {item.discount_percentage > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          {item.discount_percentage}% off
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{item.duration_months}mo</span>
                      </div>
                      {item.popularity && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item.popularity}%</span>
                          <span>popular</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date Range */}
                  {(item.start_date || item.end_date) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3 w-3" />
                      {item.start_date && format(new Date(item.start_date), "MMM dd")}
                      {item.start_date && item.end_date && " - "}
                      {item.end_date && format(new Date(item.end_date), "MMM dd, yyyy")}
                    </div>
                  )}

                  {/* Included Activities - Always Visible */}
                  {item.package_activities && item.package_activities.length > 0 && (() => {
                    // Group activities by activity_id to avoid showing duplicates
                    const groupedActivities = item.package_activities.reduce((acc: any, pa: any) => {
                      const activityId = pa.activity_id;
                      if (!acc[activityId]) {
                        acc[activityId] = {
                          activity: pa.activities,
                          instructors: []
                        };
                      }
                      if (pa.club_instructors) {
                        acc[activityId].instructors.push(pa.club_instructors);
                      }
                      return acc;
                    }, {});

                    const uniqueActivities = Object.values(groupedActivities);

                    return (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4" />
                          <h4 className="text-sm font-semibold">Included Activities ({uniqueActivities.length})</h4>
                        </div>
                        <div className="space-y-2">
                          {uniqueActivities.map((item: any, idx: number) => {
                            const activity = item.activity;
                            const instructors = item.instructors;
                            
                            if (!activity) return null;

                            return (
                              <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                                <div className="flex gap-3">
                                  {activity.picture_url && (
                                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                                      <img
                                        src={activity.picture_url}
                                        alt={activity.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <h5 className="font-semibold text-sm">{activity.title}</h5>
                                      
                                      {/* Show all instructors for this activity */}
                                      {instructors.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {instructors.map((instructor: any, iidx: number) => (
                                            <div key={iidx} className="flex items-center gap-1.5 bg-primary/10 rounded-full px-2 py-1">
                                              <Avatar className="h-5 w-5 border border-primary/20">
                                                <AvatarImage src={instructor.image_url} alt={instructor.name} />
                                                <AvatarFallback className="text-[10px] bg-primary/20">{instructor.name.charAt(0)}</AvatarFallback>
                                              </Avatar>
                                              <span className="text-[10px] font-medium text-primary">{instructor.name}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Duration and Schedule on same line */}
                                    <div className="flex flex-wrap items-center gap-3">
                                      {activity.duration_minutes && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>{activity.duration_minutes} min</span>
                                        </div>
                                      )}

                                      {activity.activity_schedules && activity.activity_schedules.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <Calendar className="h-3 w-3 text-muted-foreground" />
                                          {groupSchedulesByTime(activity.activity_schedules).map((group, sidx) => (
                                            <Badge key={sidx} variant="outline" className="text-[10px] py-0.5 px-2">
                                              {group.days}: {group.startTime} - {group.endTime}
                                            </Badge>
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
                      </div>
                    );
                  })()}
                </div>
            </Card>
          );
        })}
      </div>

      {packages.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No packages yet. Click "Add Package" to create your first one.
          </CardContent>
        </Card>
      )}
    </div>
  );
};
