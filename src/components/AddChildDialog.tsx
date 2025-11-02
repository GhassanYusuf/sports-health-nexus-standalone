import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "./SearchableSelect";
import { DatePickerField } from "./form/DatePickerField";
import { ImageUploadCropper } from "./ImageUploadCropper";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import countries from "world-countries";
import { BLOOD_TYPES, GENDERS } from "@/constants/formOptions";
import { User } from "lucide-react";

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentNationality?: string;
  onChildAdded: (childData: {
    name: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    bloodType?: string;
    avatarUrl?: string;
  }) => void;
}

const childFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  gender: z.enum(['male', 'female'], { required_error: "Gender is required" }),
  dateOfBirth: z.date({ required_error: "Date of birth is required" }),
  nationality: z.string().min(2, "Nationality is required"),
  bloodType: z.string().optional()
});

export const AddChildDialog: React.FC<AddChildDialogProps> = ({
  open,
  onOpenChange,
  parentNationality,
  onChildAdded
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    dateOfBirth: null as Date | null,
    nationality: '',
    bloodType: ''
  });
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Set default nationality from parent when dialog opens
  useEffect(() => {
    if (open && parentNationality && !formData.nationality) {
      setFormData(prev => ({ ...prev, nationality: parentNationality }));
    }
  }, [open, parentNationality]);

  const nationalityOptions = countries
    .filter((c) => c.cca2 !== "IL")
    .map((country) => ({
      value: country.name.common,
      label: country.name.common,
      icon: country.flag,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const handleSubmit = () => {
    try {
      // Validate form data
      childFormSchema.parse({
        ...formData,
        dateOfBirth: formData.dateOfBirth
      });

      // Convert date to string format
      const dateOfBirth = formData.dateOfBirth
        ? formData.dateOfBirth.toISOString().split('T')[0]
        : '';

      // Call parent callback with child data
      onChildAdded({
        name: formData.name,
        gender: formData.gender,
        dateOfBirth,
        nationality: formData.nationality,
        bloodType: formData.bloodType || undefined,
        avatarUrl: avatarUrl || undefined
      });

      // Reset form
      setFormData({
        name: '',
        gender: '',
        dateOfBirth: null,
        nationality: '',
        bloodType: ''
      });
      setAvatarUrl('');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Child Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile Picture */}
          <div className="space-y-2">
            <Label>Profile Picture (Optional)</Label>
            <ImageUploadCropper
              onImageSelected={(file) => {
                // Create a temporary URL for preview
                const url = URL.createObjectURL(file);
                setAvatarUrl(url);
              }}
              currentImageUrl={avatarUrl}
              buttonText="Upload Photo"
              showImage={true}
            />
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="child-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="child-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter child's full name"
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label>
              Gender <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={formData.gender === 'male' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormData({ ...formData, gender: 'male' })}
              >
                <User className="mr-2 h-4 w-4" />
                Male
              </Button>
              <Button
                type="button"
                variant={formData.gender === 'female' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormData({ ...formData, gender: 'female' })}
              >
                <User className="mr-2 h-4 w-4" />
                Female
              </Button>
            </div>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label>
              Date of Birth <span className="text-destructive">*</span>
            </Label>
            <DatePickerField
              value={formData.dateOfBirth || undefined}
              onSelect={(date) => setFormData({ ...formData, dateOfBirth: date || null })}
              placeholder="Select date"
              maxDate={new Date()}
              minDate={new Date('1900-01-01')}
            />
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label htmlFor="child-nationality">
              Nationality <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={formData.nationality}
              onValueChange={(value) => setFormData({ ...formData, nationality: value })}
              options={nationalityOptions}
              placeholder="Search for a country..."
              emptyMessage="No country found."
            />
          </div>

          {/* Blood Type */}
          <div className="space-y-2">
            <Label htmlFor="child-blood-type">Blood Type (Optional)</Label>
            <Select
              value={formData.bloodType}
              onValueChange={(value) => setFormData({ ...formData, bloodType: value })}
            >
              <SelectTrigger id="child-blood-type">
                <SelectValue placeholder="Select blood type" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Child
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
