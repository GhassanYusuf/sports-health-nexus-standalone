import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AdminAmenitiesProps {
  clubId: string;
}

export const AdminAmenities: React.FC<AdminAmenitiesProps> = ({ clubId }) => {
  const { toast } = useToast();
  const [amenities, setAmenities] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    available: true,
  });

  useEffect(() => {
    fetchAmenities();
  }, [clubId]);

  const fetchAmenities = async () => {
    const { data } = await supabase
      .from("club_amenities")
      .select("*")
      .eq("club_id", clubId)
      .order("name");
    setAmenities(data || []);
  };

  const resetForm = () => {
    setFormData({ name: "", icon: "", available: true });
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      icon: item.icon,
      available: item.available,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.icon) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }

    if (editingItem) {
      const { error } = await supabase
        .from("club_amenities")
        .update(formData)
        .eq("id", editingItem.id);
      if (error) {
        toast({ title: "Error updating amenity", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Amenity updated successfully" });
        fetchAmenities();
        setIsDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("club_amenities").insert([{ ...formData, club_id: clubId }]);
      if (error) {
        toast({ title: "Error creating amenity", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Amenity created successfully" });
        fetchAmenities();
        setIsDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const { error } = await supabase.from("club_amenities").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting amenity", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Amenity deleted successfully" });
      fetchAmenities();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Amenities</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Amenity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Amenity" : "Add New Amenity"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Icon (emoji or text) *</label>
                <Input value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} placeholder="🏊" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={formData.available} onCheckedChange={(checked) => setFormData({ ...formData, available: checked })} />
                <Label>Available</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingItem ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {amenities.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  {item.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs mt-1">{item.available ? "✅ Available" : "❌ Unavailable"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
