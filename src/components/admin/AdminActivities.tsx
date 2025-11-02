import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus, MapPin, Clock, Users, DollarSign, Upload, X, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageCropper } from "@/components/ImageCropper";
import { Badge } from "@/components/ui/badge";
import { TimeInput12h } from "@/components/ui/time-input-12h";
import { SimpleTimeInput } from "@/components/ui/simple-time-input";

interface AdminActivitiesProps {
  clubId: string;
  clubCurrency: string;
  onUpdate?: () => void;
}

const DAYS_OF_WEEK = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

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

const convertTo24Hour = (time12h: string): string => {
  const [time, period] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const convertTo12Hour = (time24h: string): string => {
  const [hours, minutes] = time24h.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const AdminActivities: React.FC<AdminActivitiesProps> = ({ clubId, clubCurrency, onUpdate }) => {
  const { toast } = useToast();
  const [facilities, setFacilities] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [tempSchedules, setTempSchedules] = useState<any[]>([]);
  
  const {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "4:3",
    onSuccess: (url) => {
      setUploadedImageUrl(url);
      setFormData({ ...formData, picture_url: url });
    },
  });

  const [formData, setFormData] = useState({
    facility_id: "",
    title: "",
    description: "",
    notes: "",
    picture_url: "",
    sessions_per_week: "1",
    monthly_fee: "",
    duration_minutes: "60",
    max_capacity: "",
    cost_per_session: "",
    booking_enabled: true,
    requires_prebooking: false,
  });
  
  const [newSchedule, setNewSchedule] = useState({
    day_of_week: "saturday",
    start_time: "09:00 AM",
    end_time: "10:00 AM",
    notes: "",
  });

  useEffect(() => {
    fetchFacilities();
    fetchActivities();
  }, [clubId]);

  const fetchFacilities = async () => {
    const { data } = await supabase.from("club_facilities").select("*").eq("club_id", clubId).order("name");
    setFacilities(data || []);
  };

  const fetchActivities = async () => {
    const { data, error } = await supabase
      .from("activities")
      .select("*, facilities:club_facilities!activities_club_facility_id_fkey(id, name, latitude, longitude), activity_schedules(day_of_week, start_time, end_time)")
      .eq("club_id", clubId)
      .order("title");

    if (error) {
      console.error("Error fetching activities:", error);
      toast({ title: "Error loading activities", description: error.message, variant: "destructive" });
    }

    setActivities(data || []);
  };

  const fetchSchedules = async (activityId: string) => {
    const { data } = await supabase
      .from("activity_schedules")
      .select("*")
      .eq("activity_id", activityId);
    
    const sortedData = (data || []).sort((a, b) => {
      const indexA = DAYS_OF_WEEK.indexOf(a.day_of_week);
      const indexB = DAYS_OF_WEEK.indexOf(b.day_of_week);
      return indexA - indexB;
    });
    
    setSchedules(sortedData);
  };

  const resetForm = () => {
    setFormData({
      facility_id: "",
      title: "",
      description: "",
      notes: "",
      picture_url: "",
      sessions_per_week: "1",
      monthly_fee: "",
      duration_minutes: "60",
      max_capacity: "",
      cost_per_session: "",
      booking_enabled: true,
      requires_prebooking: false,
    });
    setEditingItem(null);
    setSchedules([]);
    setTempSchedules([]);
    setUploadedImageUrl("");
    setCurrentStep(1);
    setNewSchedule({ day_of_week: "saturday", start_time: "09:00 AM", end_time: "10:00 AM", notes: "" });
  };

  const handleEdit = async (item: any) => {
    setEditingItem(item);
    const pictureUrl = item.picture_url || "";
    setUploadedImageUrl(pictureUrl);
    setFormData({
      facility_id: item.club_facility_id,
      title: item.title,
      description: item.description || "",
      notes: item.notes || "",
      picture_url: pictureUrl,
      sessions_per_week: item.sessions_per_week?.toString() || "1",
      monthly_fee: item.monthly_fee?.toString() || "",
      duration_minutes: item.duration_minutes?.toString() || "60",
      max_capacity: item.max_capacity?.toString() || "",
      cost_per_session: item.cost_per_session?.toString() || "",
      booking_enabled: item.booking_enabled !== false,
      requires_prebooking: item.requires_prebooking || false,
    });
    await fetchSchedules(item.id);
    setIsDialogOpen(true);
  };

  const handleDuplicate = async (item: any) => {
    const pictureUrl = item.picture_url || "";
    setUploadedImageUrl(pictureUrl);
    setEditingItem(null);
    setFormData({
      facility_id: item.club_facility_id,
      title: `${item.title} (Copy)`,
      description: item.description || "",
      notes: item.notes || "",
      picture_url: pictureUrl,
      sessions_per_week: item.sessions_per_week?.toString() || "1",
      monthly_fee: item.monthly_fee?.toString() || "",
      duration_minutes: item.duration_minutes?.toString() || "60",
      max_capacity: item.max_capacity?.toString() || "",
      cost_per_session: item.cost_per_session?.toString() || "",
      booking_enabled: item.booking_enabled !== false,
      requires_prebooking: item.requires_prebooking || false,
    });
    
    const { data: schedulesData } = await supabase
      .from("activity_schedules")
      .select("*")
      .eq("activity_id", item.id);
    
    const duplicatedSchedules = (schedulesData || []).map(schedule => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      day_of_week: schedule.day_of_week,
      start_time: convertTo12Hour(schedule.start_time),
      end_time: convertTo12Hour(schedule.end_time),
      notes: schedule.notes || "",
    }));
    
    setTempSchedules(duplicatedSchedules);
    setIsDialogOpen(true);
    toast({ title: "Activity duplicated", description: "Modify the details and save to create" });
  };

  const handleSubmit = async () => {
    if (!formData.facility_id || !formData.title || !formData.monthly_fee) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }

    const activeSchedules = editingItem ? schedules : tempSchedules;
    
    let calculatedDuration = 60;
    if (activeSchedules.length > 0) {
      const firstSchedule = activeSchedules[0];
      const time24h = firstSchedule.start_time.includes('M') ? convertTo24Hour(firstSchedule.start_time) : firstSchedule.start_time;
      const endTime24h = firstSchedule.end_time.includes('M') ? convertTo24Hour(firstSchedule.end_time) : firstSchedule.end_time;
      const [startHour, startMin] = time24h.split(':').map(Number);
      const [endHour, endMin] = endTime24h.split(':').map(Number);
      calculatedDuration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    const calculatedSessionsPerWeek = activeSchedules.length || 1;

    const payload = {
      club_id: clubId,
      club_facility_id: formData.facility_id,
      title: formData.title,
      description: formData.description || null,
      notes: formData.notes || null,
      picture_url: formData.picture_url || null,
      sessions_per_week: calculatedSessionsPerWeek,
      monthly_fee: parseFloat(formData.monthly_fee),
      duration_minutes: calculatedDuration,
      max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null,
      cost_per_session: formData.cost_per_session ? parseFloat(formData.cost_per_session) : null,
      booking_enabled: formData.booking_enabled,
      requires_prebooking: formData.requires_prebooking,
    };

    if (editingItem) {
      const { error } = await supabase.from("activities").update(payload).eq("id", editingItem.id);
      if (error) {
        toast({ title: "Error updating activity", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Activity updated successfully" });
        fetchActivities();
        setIsDialogOpen(false);
        resetForm();
      }
    } else {
      const { data, error } = await supabase.from("activities").insert(payload).select().single();
      if (error) {
        toast({ title: "Error creating activity", description: error.message, variant: "destructive" });
        return;
      }
      
      if (tempSchedules.length > 0) {
        const schedulesToInsert = tempSchedules.map(schedule => ({
          activity_id: data.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time.includes('M') ? convertTo24Hour(schedule.start_time) : schedule.start_time,
          end_time: schedule.end_time.includes('M') ? convertTo24Hour(schedule.end_time) : schedule.end_time,
          notes: schedule.notes || null,
        }));
        
        await supabase.from("activity_schedules").insert(schedulesToInsert);
      }
      
      toast({ title: "Activity created successfully" });
      fetchActivities();
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const addSchedule = async () => {
    const start24h = newSchedule.start_time.includes('M') ? convertTo24Hour(newSchedule.start_time) : newSchedule.start_time;
    const end24h = newSchedule.end_time.includes('M') ? convertTo24Hour(newSchedule.end_time) : newSchedule.end_time;
    
    if (start24h >= end24h) {
      toast({ title: "Invalid time range", description: "End time must be after start time", variant: "destructive" });
      return;
    }
    
    if (editingItem) {
      const { error } = await supabase.from("activity_schedules").insert({
        activity_id: editingItem.id,
        day_of_week: newSchedule.day_of_week,
        start_time: start24h,
        end_time: end24h,
        notes: newSchedule.notes || null,
      });

      if (error) {
        toast({ title: "Error adding schedule", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Schedule added successfully" });
        fetchSchedules(editingItem.id);
      }
    } else {
      setTempSchedules([...tempSchedules, {
        id: `temp-${Date.now()}`,
        day_of_week: newSchedule.day_of_week,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        notes: newSchedule.notes || null,
      }]);
      toast({ title: "Schedule added", description: "Will be saved when activity is created" });
    }
  };

  const updateSchedule = async (scheduleId: string, updates: any) => {
    if (updates.start_time && updates.start_time.includes('M')) {
      updates.start_time = convertTo24Hour(updates.start_time);
    }
    if (updates.end_time && updates.end_time.includes('M')) {
      updates.end_time = convertTo24Hour(updates.end_time);
    }
    
    if (updates.start_time && updates.end_time) {
      if (updates.start_time >= updates.end_time) {
        toast({ title: "Invalid time range", description: "End time must be after start time", variant: "destructive" });
        return;
      }
    }

    if (scheduleId.startsWith('temp-')) {
      setTempSchedules(tempSchedules.map(s => s.id === scheduleId ? { ...s, ...updates } : s));
      toast({ title: "Schedule updated" });
    } else {
      const { error } = await supabase
        .from("activity_schedules")
        .update(updates)
        .eq("id", scheduleId);
      
      if (error) {
        toast({ title: "Error updating schedule", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Schedule updated successfully" });
        if (editingItem) fetchSchedules(editingItem.id);
        setEditingSchedule(null);
      }
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (scheduleId.startsWith('temp-')) {
      setTempSchedules(tempSchedules.filter(s => s.id !== scheduleId));
      toast({ title: "Schedule removed" });
    } else {
      const { error } = await supabase.from("activity_schedules").delete().eq("id", scheduleId);
      if (error) {
        toast({ title: "Error deleting schedule", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Schedule deleted successfully" });
        if (editingItem) fetchSchedules(editingItem.id);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will also delete all schedules for this activity.")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting activity", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Activity deleted successfully" });
      fetchActivities();
      onUpdate?.();
    }
  };

  const activeSchedules = editingItem ? schedules : tempSchedules;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Activities Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingItem ? "Edit Activity" : "Create New Activity"}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Follow the steps to configure your activity
              </DialogDescription>
            </DialogHeader>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mt-6 mb-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all cursor-pointer relative ${
                      currentStep === step
                        ? 'bg-red-500 text-white scale-110 shadow-lg'
                        : currentStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    onClick={() => setCurrentStep(step)}
                  >
                    {currentStep > step ? '✓' : step}
                    {currentStep === step && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                    )}
                  </div>
                  {step < 4 && <div className={`w-12 h-0.5 ${currentStep > step ? 'bg-green-500' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            <div className="text-center mb-6">
              <p className="text-sm font-medium">
                {currentStep === 1 && "Step 1: Basic Information"}
                {currentStep === 2 && "Step 2: Pricing Details"}
                {currentStep === 3 && "Step 3: Schedule Configuration"}
                {currentStep === 4 && "Step 4: Booking Settings"}
              </p>
            </div>

            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Activity Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Morning Yoga Class"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Detailed description of the activity..."
                    />
                  </div>

                  <div>
                    <Label>Facility / Location *</Label>
                    <Select value={formData.facility_id} onValueChange={(value) => setFormData({ ...formData, facility_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((facility) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      <Users className="inline w-4 h-4 mr-1" />
                      Max Capacity
                    </Label>
                    <Input
                      type="number"
                      value={formData.max_capacity}
                      onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
                      placeholder="20"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                      <p className="text-sm font-medium">Auto-calculated from Schedules:</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Sessions per week: {activeSchedules.length || 0}</span>
                        <span>Duration: {activeSchedules.length > 0 ? (() => {
                          const first = activeSchedules[0];
                          const start24h = first.start_time.includes('M') ? convertTo24Hour(first.start_time) : first.start_time;
                          const end24h = first.end_time.includes('M') ? convertTo24Hour(first.end_time) : first.end_time;
                          const [startHour, startMin] = start24h.split(':').map(Number);
                          const [endHour, endMin] = end24h.split(':').map(Number);
                          return (endHour * 60 + endMin) - (startHour * 60 + startMin);
                        })() : 60} minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>Activity Picture</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileSelect(file, clubId, "activity");
                            }
                          }}
                          className="flex-1"
                          disabled={isUploading}
                        />
                        {uploadedImageUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUploadedImageUrl("");
                              setFormData({ ...formData, picture_url: "" });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {uploadedImageUrl && (
                        <div className="relative">
                          <img 
                            src={uploadedImageUrl} 
                            alt="Preview" 
                            className="mt-2 h-32 w-full object-cover rounded" 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>Additional Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      placeholder="Any additional information..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Pricing */}
            {currentStep === 2 && (
              <div className="space-y-6 mt-6">
                <Card className="border-primary/20">
                  <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Pricing Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>
                          <DollarSign className="inline w-4 h-4 mr-1" />
                          Monthly Fee ({clubCurrency}) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.monthly_fee}
                          onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                          placeholder="99.99"
                        />
                      </div>

                      <div>
                        <Label>
                          <DollarSign className="inline w-4 h-4 mr-1" />
                          Cost Per Session ({clubCurrency})
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cost_per_session}
                          onChange={(e) => setFormData({ ...formData, cost_per_session: e.target.value })}
                          placeholder="15.00"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Activity Schedules</Label>
                    <Badge variant="secondary">{activeSchedules.length} schedule{activeSchedules.length !== 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="space-y-3">
                    {activeSchedules.map((schedule) => {
                      const isEditing = editingSchedule?.id === schedule.id;
                      const currentSchedule = isEditing ? editingSchedule : schedule;
                      const display12hStart = currentSchedule.start_time.includes('M') ? currentSchedule.start_time : convertTo12Hour(currentSchedule.start_time);
                      const display12hEnd = currentSchedule.end_time.includes('M') ? currentSchedule.end_time : convertTo12Hour(currentSchedule.end_time);
                      
                      return (
                        <div key={schedule.id} className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-3">
                              <Label className="text-xs text-muted-foreground mb-1">Day</Label>
                              <Select 
                                value={currentSchedule.day_of_week} 
                                onValueChange={(value) => updateSchedule(schedule.id, { day_of_week: value })}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAYS_OF_WEEK.map((day) => (
                                    <SelectItem key={day} value={day}>
                                      {day.charAt(0).toUpperCase() + day.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="md:col-span-3">
                              <Label className="text-xs text-muted-foreground mb-1">Start Time</Label>
                              <SimpleTimeInput
                                value={display12hStart}
                                onChange={(value) => {
                                  updateSchedule(schedule.id, { 
                                    start_time: value,
                                    end_time: currentSchedule.end_time
                                  });
                                }}
                                placeholder="09:00 AM"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <Label className="text-xs text-muted-foreground mb-1">End Time</Label>
                              <SimpleTimeInput
                                value={display12hEnd}
                                onChange={(value) => {
                                  updateSchedule(schedule.id, { 
                                    start_time: currentSchedule.start_time,
                                    end_time: value
                                  });
                                }}
                                placeholder="10:00 AM"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-xs text-muted-foreground mb-1">Note</Label>
                              <Input
                                type="text"
                                className="h-10"
                                value={currentSchedule.notes || ""}
                                onChange={(e) => {
                                  setEditingSchedule({ ...schedule, notes: e.target.value });
                                }}
                                onBlur={(e) => {
                                  if (e.target.value !== (schedule.notes || "")) {
                                    updateSchedule(schedule.id, { notes: e.target.value || null });
                                  } else {
                                    setEditingSchedule(null);
                                  }
                                }}
                                placeholder="Note..."
                                maxLength={200}
                              />
                            </div>
                            <div className="md:col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => deleteSchedule(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-4 mt-6">
                  <Label className="text-base font-semibold mb-3 block">Add New Schedule</Label>
                  <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1">Day</Label>
                        <Select
                          value={newSchedule.day_of_week}
                          onValueChange={(value) => setNewSchedule({ ...newSchedule, day_of_week: value })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day} value={day}>
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1">Start Time</Label>
                        <SimpleTimeInput
                          value={newSchedule.start_time}
                          onChange={(value) => setNewSchedule({ ...newSchedule, start_time: value })}
                          placeholder="09:00 AM"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1">End Time</Label>
                        <SimpleTimeInput
                          value={newSchedule.end_time}
                          onChange={(value) => setNewSchedule({ ...newSchedule, end_time: value })}
                          placeholder="10:00 AM"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground mb-1">Note</Label>
                        <Input
                          type="text"
                          className="h-10"
                          value={newSchedule.notes}
                          onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                          placeholder="Note..."
                          maxLength={200}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button type="button" onClick={addSchedule} className="h-10 w-full">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Booking */}
            {currentStep === 4 && (
              <div className="space-y-6 mt-6">
                <Card className="border-primary/20">
                  <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Booking Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded">
                        <div>
                          <Label>Enable Booking</Label>
                          <p className="text-sm text-muted-foreground">Allow members to book this activity</p>
                        </div>
                        <Switch
                          checked={formData.booking_enabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, booking_enabled: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded">
                        <div>
                          <Label>Require Pre-booking</Label>
                          <p className="text-sm text-muted-foreground">Members must book in advance</p>
                        </div>
                        <Switch
                          checked={formData.requires_prebooking}
                          onCheckedChange={(checked) => setFormData({ ...formData, requires_prebooking: checked })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : null}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                
                {currentStep < 4 ? (
                  <Button type="button" onClick={() => setCurrentStep(currentStep + 1)}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit}>
                    {editingItem ? "Update Activity" : "Create Activity"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map((item) => (
          <Card key={item.id}>
            {item.picture_url && (
              <div className="w-full h-48 overflow-hidden rounded-t-lg">
                <img 
                  src={item.picture_url} 
                  alt={item.title} 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(item)} title="Duplicate Activity">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(item)} title="Edit Activity">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)} title="Delete Activity">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-3 w-3" />
                <span className="font-medium">{formatCurrency(item.monthly_fee, clubCurrency)}/month</span>
              </div>
              {item.cost_per_session && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatCurrency(item.cost_per_session, clubCurrency)} per session</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {item.duration_minutes} min • {item.sessions_per_week}x/week
              </div>
              {item.max_capacity && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Max {item.max_capacity} participants
                </div>
              )}
              {item.facilities && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {item.facilities.name}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {item.booking_enabled && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">Booking Open</Badge>
                )}
                {item.requires_prebooking && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">Pre-booking Required</Badge>
                )}
              </div>
              {item.activity_schedules && item.activity_schedules.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.activity_schedules.map((schedule: any, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs capitalize">
                      {schedule.day_of_week.slice(0, 3)}: {formatTimeTo12Hour(schedule.start_time)}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
