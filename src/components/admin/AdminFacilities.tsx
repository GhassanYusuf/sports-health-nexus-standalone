import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, Plus, MapPin, Upload, Clock, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import LeafletLocationMap from "@/components/LeafletLocationMap";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast as sonnerToast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TimeInput12h } from "@/components/ui/time-input-12h";

interface AdminFacilitiesProps {
  clubId: string;
  onUpdate?: () => void;
}

interface Facility {
  id: string;
  name: string;
  address: string;
  description: string | null;
  latitude: number;
  longitude: number;
  map_zoom?: number;
  is_rentable: boolean;
  is_available: boolean;
}

interface FacilityWithDistance extends Facility {
  distance?: number;
}

interface OperatingHour {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface RentableTime {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface FacilityPicture {
  id: string;
  image_url: string;
  display_order: number;
}

export const AdminFacilities: React.FC<AdminFacilitiesProps> = ({ clubId, onUpdate }) => {
  const { toast } = useToast();
  const [facilities, setFacilities] = useState<FacilityWithDistance[]>([]);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pictures, setPictures] = useState<FacilityPicture[]>([]);
  const [newFacilityPictures, setNewFacilityPictures] = useState<string[]>([]); // Store URLs for new facility
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
  const [rentableTimes, setRentableTimes] = useState<RentableTime[]>([]);
  const [facilityPictures, setFacilityPictures] = useState<Record<string, FacilityPicture[]>>({});
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    description: "",
    latitude: "",
    longitude: "",
    map_zoom: "13",
    is_rentable: false,
    is_available: true,
  });

  const {
    imageToEdit,
    isUploading,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "16:9",
    maxOutputSize: 2048,
    bucket: "avatars",
    onSuccess: async (url) => {
      if (editingFacility) {
        // Editing existing facility - save directly to database
        const { error } = await supabase.from("facility_pictures").insert({
          club_facility_id: editingFacility.id,
          image_url: url,
          display_order: pictures.length,
        });

        if (error) {
          toast({ title: "Error adding picture", description: error.message, variant: "destructive" });
        } else {
          fetchFacilityPictures(editingFacility.id);
        }
      } else {
        // Creating new facility - store in temporary state
        setNewFacilityPictures(prev => [...prev, url]);
        toast({ title: "Picture added", description: "Picture will be saved when you create the facility" });
      }
    },
  });

  useEffect(() => {
    fetchFacilities();
    getUserLocation();
  }, [clubId]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Could not get user location", error);
        }
      );
    }
  };

  const calculateDrivingDistance = async (facilityLat: number, facilityLng: number): Promise<number | null> => {
    if (!userLocation) return null;
    
    try {
      // Using OSRM (Open Source Routing Machine) - completely free, no API key needed
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${facilityLng},${facilityLat}?overview=false`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // Distance is in meters, convert to kilometers
        const distanceKm = data.routes[0].distance / 1000;
        return Math.round(distanceKm * 10) / 10; // Round to 1 decimal
      }
      
      return null;
    } catch (error) {
      console.error("Error calculating distance:", error);
      return null;
    }
  };

  useEffect(() => {
    // Fetch pictures for all facilities
    const fetchAllFacilityPictures = async () => {
      const picturesMap: Record<string, FacilityPicture[]> = {};
      
      for (const facility of facilities) {
        const { data, error } = await supabase
          .from("facility_pictures")
          .select("*")
          .eq("club_facility_id", facility.id)
          .order("display_order");

        if (!error && data) {
          picturesMap[facility.id] = data;
        }
      }
      
      setFacilityPictures(picturesMap);
    };

    if (facilities.length > 0) {
      fetchAllFacilityPictures();
    }
  }, [facilities]);

  const fetchFacilities = async () => {
    const { data, error } = await supabase
      .from("club_facilities")
      .select("*")
      .eq("club_id", clubId)
      .order("name");

    if (error) {
      toast({ title: "Error fetching facilities", description: error.message, variant: "destructive" });
    } else {
      const facilitiesData = data || [];
      
      // Calculate distances if user location is available
      if (userLocation) {
        const facilitiesWithDistance = await Promise.all(
          facilitiesData.map(async (facility) => {
            const distance = await calculateDrivingDistance(facility.latitude, facility.longitude);
            return { ...facility, distance };
          })
        );
        setFacilities(facilitiesWithDistance);
      } else {
        setFacilities(facilitiesData);
      }
    }
  };

  const fetchFacilityPictures = async (facilityId: string) => {
    const { data, error } = await supabase
      .from("facility_pictures")
      .select("*")
      .eq("club_facility_id", facilityId)
      .order("display_order");

    if (error) {
      toast({ title: "Error fetching pictures", description: error.message, variant: "destructive" });
    } else {
      setPictures(data || []);
    }
  };

  const fetchOperatingHours = async (facilityId: string) => {
    const { data, error } = await supabase
      .from("facility_operating_hours")
      .select("*")
      .eq("club_facility_id", facilityId);

    if (error) {
      toast({ title: "Error fetching operating hours", description: error.message, variant: "destructive" });
    } else {
      setOperatingHours(data || []);
    }
  };

  const fetchRentableTimes = async (facilityId: string) => {
    const { data, error } = await supabase
      .from("facility_rentable_times")
      .select("*")
      .eq("club_facility_id", facilityId);

    if (error) {
      toast({ title: "Error fetching rentable times", description: error.message, variant: "destructive" });
    } else {
      setRentableTimes(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (operatingHours.length === 0) {
      toast({ title: "Please add at least one operating hour", variant: "destructive" });
      return;
    }

    if (formData.is_rentable && rentableTimes.length === 0) {
      toast({ title: "Please add rentable times for rentable facilities", variant: "destructive" });
      return;
    }

    const facilityData = {
      club_id: clubId,
      name: formData.name,
      address: formData.address,
      description: formData.description || null,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      map_zoom: parseInt(formData.map_zoom),
      is_rentable: formData.is_rentable,
      is_available: formData.is_available,
    };

    if (editingFacility) {
      const { error } = await supabase
        .from("club_facilities")
        .update(facilityData)
        .eq("id", editingFacility.id);

      if (error) {
        toast({ title: "Error updating facility", description: error.message, variant: "destructive" });
        return;
      }

      // Update operating hours
      await supabase.from("facility_operating_hours").delete().eq("club_facility_id", editingFacility.id);
      const hoursData = operatingHours.map(h => ({
        club_facility_id: editingFacility.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
      }));
      await supabase.from("facility_operating_hours").insert(hoursData);

      // Update rentable times
      await supabase.from("facility_rentable_times").delete().eq("club_facility_id", editingFacility.id);
      if (formData.is_rentable && rentableTimes.length > 0) {
        const timesData = rentableTimes.map(t => ({
          club_facility_id: editingFacility.id,
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time,
        }));
        await supabase.from("facility_rentable_times").insert(timesData);
      }

      toast({ title: "Facility updated successfully" });
      setIsDialogOpen(false);
      resetForm();
      fetchFacilities();
      onUpdate?.();
    } else {
      const { data: newFacility, error } = await supabase
        .from("club_facilities")
        .insert(facilityData)
        .select()
        .single();

      if (error || !newFacility) {
        toast({ title: "Error creating facility", description: error?.message, variant: "destructive" });
        return;
      }

      // Insert operating hours
      const hoursData = operatingHours.map(h => ({
        club_facility_id: newFacility.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
      }));
      await supabase.from("facility_operating_hours").insert(hoursData);

      // Insert rentable times
      if (formData.is_rentable && rentableTimes.length > 0) {
        const timesData = rentableTimes.map(t => ({
          club_facility_id: newFacility.id,
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time,
        }));
        await supabase.from("facility_rentable_times").insert(timesData);
      }

      // Insert pictures if any were uploaded during creation
      if (newFacilityPictures.length > 0) {
        const picturesData = newFacilityPictures.map((url, index) => ({
          club_facility_id: newFacility.id,
          image_url: url,
          display_order: index,
        }));
        await supabase.from("facility_pictures").insert(picturesData);
      }

      toast({ title: "Facility created successfully" });
      setIsDialogOpen(false);
      resetForm();
      fetchFacilities();
      onUpdate?.();
    }
  };

  const handleEdit = async (facility: Facility) => {
    setEditingFacility(facility);
    setFormData({
      name: facility.name,
      address: facility.address,
      description: facility.description || "",
      latitude: facility.latitude.toString(),
      longitude: facility.longitude.toString(),
      map_zoom: facility.map_zoom?.toString() || "13",
      is_rentable: facility.is_rentable,
      is_available: facility.is_available,
    });
    fetchFacilityPictures(facility.id);
    await fetchOperatingHours(facility.id);
    await fetchRentableTimes(facility.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this facility?")) return;

    const { error } = await supabase.from("club_facilities").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting facility", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Facility deleted successfully" });
      fetchFacilities();
      onUpdate?.();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      description: "",
      latitude: "25.2048",
      longitude: "55.2708",
      map_zoom: "13",
      is_rentable: false,
      is_available: true,
    });
    setEditingFacility(null);
    setPictures([]);
    setNewFacilityPictures([]);
    setOperatingHours([]);
    setRentableTimes([]);
  };

  const addOperatingHour = () => {
    setOperatingHours([...operatingHours, { day_of_week: "Monday", start_time: "08:00", end_time: "22:00" }]);
  };

  const removeOperatingHour = (index: number) => {
    setOperatingHours(operatingHours.filter((_, i) => i !== index));
  };

  const updateOperatingHour = (index: number, field: keyof OperatingHour, value: string) => {
    const updated = [...operatingHours];
    updated[index] = { ...updated[index], [field]: value };
    setOperatingHours(updated);
  };

  const addRentableTime = () => {
    setRentableTimes([...rentableTimes, { day_of_week: "Monday", start_time: "08:00", end_time: "22:00" }]);
  };

  const removeRentableTime = (index: number) => {
    setRentableTimes(rentableTimes.filter((_, i) => i !== index));
  };

  const updateRentableTime = (index: number, field: keyof RentableTime, value: string) => {
    const updated = [...rentableTimes];
    updated[index] = { ...updated[index], [field]: value };
    setRentableTimes(updated);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Get current user ID for upload path
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }
    
    const facilityId = editingFacility?.id || 'new';
    await handleFileSelect(file, user.id, `club-${clubId}-facility-${facilityId}-picture-${Date.now()}`);
  };

  const deletePicture = async (pictureId: string) => {
    const { error } = await supabase.from("facility_pictures").delete().eq("id", pictureId);

    if (error) {
      toast({ title: "Error deleting picture", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Picture deleted successfully" });
      if (editingFacility) {
        fetchFacilityPictures(editingFacility.id);
      }
    }
  };

  const deleteNewPicture = (url: string) => {
    setNewFacilityPictures(prev => prev.filter(picUrl => picUrl !== url));
    toast({ title: "Picture removed" });
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
    }));
  };

  const handleAddressChange = (address: string) => {
    setFormData(prev => ({
      ...prev,
      address: address,
    }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center pb-6 border-b border-border/50">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            Facilities Management
          </h2>
          <p className="text-muted-foreground mt-1">Manage your club's facilities, locations, and availability</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="shadow-medium hover:shadow-strong transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFacility ? "Edit Facility" : "Add New Facility"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Facility Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Address *</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label>Location on Map (Drag marker to set) *</Label>
                  <div className="h-64 rounded-lg overflow-hidden border">
                    <LeafletLocationMap
                      latitude={editingFacility && formData.latitude ? parseFloat(formData.latitude) : undefined}
                      longitude={editingFacility && formData.longitude ? parseFloat(formData.longitude) : undefined}
                      zoom={formData.map_zoom ? parseInt(formData.map_zoom) : 13}
                      onLocationChange={handleLocationChange}
                      onAddressChange={handleAddressChange}
                      onZoomChange={(zoom) => {
                        setFormData({ ...formData, map_zoom: zoom.toString() });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        <MapPin className="inline w-3 h-3 mr-1" />
                        Latitude
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                        placeholder="25.2048"
                        required
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        <MapPin className="inline w-3 h-3 mr-1" />
                        Longitude
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                        placeholder="55.2708"
                        required
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <Label>
                      <Clock className="inline w-4 h-4 mr-1" />
                      Operating Hours *
                    </Label>
                    <Button type="button" size="sm" onClick={addOperatingHour}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {operatingHours.map((hour, index) => (
                      <div key={index} className="flex gap-2 items-center bg-muted/50 p-2 rounded">
                        <select
                          value={hour.day_of_week}
                          onChange={(e) => updateOperatingHour(index, "day_of_week", e.target.value)}
                          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <TimeInput12h
                          value={hour.start_time}
                          onChange={(value) => updateOperatingHour(index, "start_time", value)}
                        />
                        <span className="text-muted-foreground">to</span>
                        <TimeInput12h
                          value={hour.end_time}
                          onChange={(value) => updateOperatingHour(index, "end_time", value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOperatingHour(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {operatingHours.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No operating hours added yet
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_rentable"
                    checked={formData.is_rentable}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_rentable: checked as boolean })}
                  />
                  <label htmlFor="is_rentable" className="text-sm cursor-pointer">
                    Available for Rent
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_available"
                    checked={formData.is_available}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked as boolean })}
                  />
                  <label htmlFor="is_available" className="text-sm cursor-pointer">
                    Currently Available
                  </label>
                </div>

                {formData.is_rentable && (
                  <div className="col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <Label>
                        <Clock className="inline w-4 h-4 mr-1" />
                        Rentable Times *
                      </Label>
                      <Button type="button" size="sm" onClick={addRentableTime}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {rentableTimes.map((time, index) => (
                        <div key={index} className="flex gap-2 items-center bg-accent/10 p-2 rounded">
                          <select
                            value={time.day_of_week}
                            onChange={(e) => updateRentableTime(index, "day_of_week", e.target.value)}
                            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                          <TimeInput12h
                            value={time.start_time}
                            onChange={(value) => updateRentableTime(index, "start_time", value)}
                          />
                          <span className="text-muted-foreground">to</span>
                          <TimeInput12h
                            value={time.end_time}
                            onChange={(value) => updateRentableTime(index, "end_time", value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRentableTime(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {rentableTimes.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No rentable times added yet
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Facility Pictures (16:9 Aspect Ratio)</Label>
                    <label htmlFor="facility-image-upload">
                      <Button type="button" size="sm" asChild disabled={isUploading}>
                        <span className="cursor-pointer">
                          <Upload className="h-3 w-3 mr-1" />
                          {isUploading ? "Uploading..." : "Upload Image"}
                        </span>
                      </Button>
                    </label>
                    <input
                      id="facility-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                  
                  {/* Show pictures for editing facility */}
                  {editingFacility && (
                    <div className="grid grid-cols-3 gap-4">
                      {pictures.map((picture) => (
                        <div key={picture.id} className="relative group aspect-video">
                          <img
                            src={picture.image_url}
                            alt="Facility"
                            className="w-full h-full object-cover rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deletePicture(picture.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show pictures for new facility */}
                  {!editingFacility && newFacilityPictures.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {newFacilityPictures.map((url, index) => (
                        <div key={index} className="relative group aspect-video">
                          <img
                            src={url}
                            alt="Facility"
                            className="w-full h-full object-cover rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteNewPicture(url)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {!editingFacility && newFacilityPictures.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded">
                      No pictures uploaded yet. Click "Upload Image" to add facility pictures.
                    </p>
                  )}
                  {editingFacility && pictures.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded">
                      No pictures uploaded yet. Click "Upload Image" to add facility pictures.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingFacility ? "Update Facility" : "Create Facility"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          aspectRatioType="16:9"
          onCropComplete={handleCropComplete}
          onClose={handleCloseCropper}
          maxOutputSize={2048}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {facilities.map((facility) => {
          const pictures = facilityPictures[facility.id] || [];
          
          return (
            <Card 
              key={facility.id} 
              className="group relative shadow-soft hover:shadow-medium transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-br from-card via-card to-accent/5"
            >
              {/* Image Slideshow */}
              <div className="relative w-full h-40 bg-gradient-to-br from-muted/50 to-muted/30 overflow-hidden">
                {pictures.length > 0 ? (
                  <Carousel className="w-full h-full">
                    <CarouselContent>
                      {pictures.map((picture) => (
                        <CarouselItem key={picture.id}>
                          <div className="relative w-full h-40">
                            <img
                              src={picture.image_url}
                              alt="Facility"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {pictures.length > 1 && (
                      <>
                        <CarouselPrevious className="left-2 h-7 w-7 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background" />
                        <CarouselNext className="right-2 h-7 w-7 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background" />
                      </>
                    )}
                  </Carousel>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center animate-pulse">
                      <MapPin className="h-10 w-10 text-primary/30 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No images</p>
                    </div>
                  </div>
                )}
                
                {/* Floating Status Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {facility.is_rentable && (
                    <span className="inline-flex items-center text-xs font-semibold bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-full backdrop-blur-sm shadow-medium">
                      🏠 Rentable
                    </span>
                  )}
                  {facility.is_available ? (
                    <span className="inline-flex items-center text-xs font-semibold bg-success/90 text-white px-2.5 py-1 rounded-full backdrop-blur-sm shadow-medium">
                      ✓ Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded-full backdrop-blur-sm shadow-medium">
                      ✕ Unavailable
                    </span>
                  )}
                </div>

                {/* Hover Overlay - Removed, buttons moved to bottom */}
              </div>
              
              {/* Content Section */}
              <CardContent className="p-4 space-y-3">
                {/* Title */}
                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {facility.name}
                  </h3>
                  {facility.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 leading-relaxed">
                      {facility.description}
                    </p>
                  )}
                </div>

                {/* Location Info - Simplified */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="line-clamp-1">{facility.address}</span>
                  </div>
                  {facility.distance !== undefined && facility.distance !== null && (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium">
                      <span>🚗</span>
                      <span>{facility.distance} km away</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shadow-soft h-8 text-xs"
                    onClick={() => openInMaps(facility.latitude, facility.longitude)}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Open in Maps
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(facility)}
                    className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(facility.id)}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {facilities.length === 0 && (
        <Card className="border-dashed border-2 shadow-soft">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No Facilities Yet</h3>
                <p className="text-muted-foreground max-w-md">
                  Get started by adding your first facility. Track locations, manage availability, and more.
                </p>
              </div>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="mt-4 shadow-medium hover:shadow-strong transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Facility
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
