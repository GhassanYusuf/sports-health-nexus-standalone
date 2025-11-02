import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plus, Trash2, Link as LinkIcon, Upload, Edit2, X } from "lucide-react";

interface AdminGalleryProps {
  clubId: string;
}

interface ClubPicture {
  id: string;
  club_id: string;
  image_url: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export const AdminGallery: React.FC<AdminGalleryProps> = ({ clubId }) => {
  const { toast } = useToast();
  const [pictures, setPictures] = useState<ClubPicture[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPicture, setEditingPicture] = useState<ClubPicture | null>(null);
  const [uploadMethod, setUploadMethod] = useState<"upload" | "url">("upload");
  
  // Form states
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [editDescription, setEditDescription] = useState("");
  
  const {
    imageToEdit,
    isUploading,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
  } = useImageUpload({
    aspectRatioType: "rectangle",
    maxOutputSize: 2048,
    bucket: "avatars",
    onSuccess: async (url) => {
      await saveNewPicture(url);
    },
  });

  useEffect(() => {
    fetchPictures();
  }, [clubId]);

  const fetchPictures = async () => {
    const { data, error } = await supabase
      .from("club_pictures")
      .select("*")
      .eq("club_id", clubId)
      .order("display_order", { ascending: true });

    if (error) {
      toast({ title: "Error fetching pictures", description: error.message, variant: "destructive" });
    } else {
      setPictures(data || []);
    }
  };

  const saveNewPicture = async (url: string) => {
    const { error } = await supabase.from("club_pictures").insert({
      club_id: clubId,
      image_url: url,
      description: description || null,
      display_order: pictures.length,
    });

    if (error) {
      toast({ title: "Error adding picture", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Picture added successfully" });
      setIsAddDialogOpen(false);
      setDescription("");
      setImageUrl("");
      fetchPictures();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    await handleFileSelect(file, user.id, `club-${clubId}-gallery`);
  };

  const handleUrlSubmit = async () => {
    if (!imageUrl.trim()) {
      toast({ title: "Error", description: "Please enter an image URL", variant: "destructive" });
      return;
    }
    await saveNewPicture(imageUrl);
  };

  const handleDeletePicture = async (pictureId: string) => {
    const { error } = await supabase.from("club_pictures").delete().eq("id", pictureId);

    if (error) {
      toast({ title: "Error deleting picture", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Picture deleted successfully" });
      fetchPictures();
    }
  };

  const handleUpdateDescription = async () => {
    if (!editingPicture) return;

    const { error } = await supabase
      .from("club_pictures")
      .update({ description: editDescription || null })
      .eq("id", editingPicture.id);

    if (error) {
      toast({ title: "Error updating description", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Description updated successfully" });
      setIsEditDialogOpen(false);
      setEditingPicture(null);
      setEditDescription("");
      fetchPictures();
    }
  };

  const openEditDialog = (picture: ClubPicture) => {
    setEditingPicture(picture);
    setEditDescription(picture.description || "");
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Club Gallery</h3>
          <p className="text-muted-foreground mt-1">Manage your club's image gallery</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Picture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Picture</DialogTitle>
            </DialogHeader>
            
            <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "upload" | "url")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  From URL
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4">
                <div>
                  <Label>Select Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    disabled={isUploading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll be able to crop and adjust the image before uploading
                  </p>
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description for this image..."
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="url" className="space-y-4">
                <div>
                  <Label>Image URL</Label>
                  <Input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description for this image..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleUrlSubmit} className="w-full">
                  Add from URL
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Image Cropper Dialog */}
      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          aspectRatioType="rectangle"
          onCropComplete={handleCropComplete}
          onClose={handleCloseCropper}
          maxOutputSize={2048}
        />
      )}

      {/* Edit Description Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPicture && (
              <img
                src={editingPicture.image_url}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
              />
            )}
            <div>
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description for this image..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDescription}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gallery Grid */}
      {pictures.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No pictures yet. Add your first gallery image!</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pictures.map((picture) => (
            <Card key={picture.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={picture.image_url}
                  alt={picture.description || "Gallery image"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80"
                    onClick={() => openEditDialog(picture)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 p-0 backdrop-blur-sm"
                    onClick={() => handleDeletePicture(picture.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {picture.description && (
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {picture.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
