import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AspectRatioType } from "@/components/ImageCropper";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface UseImageUploadOptions {
  aspectRatioType?: AspectRatioType;
  maxOutputSize?: number;
  bucket?: string;
  onSuccess?: (url: string) => void;
}

export const useImageUpload = (options: UseImageUploadOptions = {}) => {
  const {
    aspectRatioType = "square",
    maxOutputSize = 2048,
    bucket = "avatars",
    onSuccess,
  } = options;

  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [queuedBlob, setQueuedBlob] = useState<Blob | null>(null);
  const [pendingUploadData, setPendingUploadData] = useState<{
    userId: string;
    path: string;
  } | null>(null);

  const handleFileSelect = async (file: File, userId: string, path: string) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      // File is too large, open cropper for compression
      const reader = new FileReader();
      reader.onload = () => {
        setImageToEdit(reader.result as string);
        setPendingUploadData({ userId, path });
      };
      reader.readAsDataURL(file);
      toast.info("Image is too large. Please crop and compress it.");
      return;
    }

    // File is within size limit, but still offer cropping
    const reader = new FileReader();
    reader.onload = () => {
      setImageToEdit(reader.result as string);
      setPendingUploadData({ userId, path });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!pendingUploadData) return;

    try {
      // If user not authenticated yet, queue the blob and preview only
      const { data: { session } } = await supabase.auth.getSession();
      const authedUserId = session?.user?.id ?? null;

      if (!authedUserId) {
        setQueuedBlob(croppedBlob);
        setImageToEdit(null);
        toast.message("Photo ready", { description: "We’ll upload it securely after you create your account." });
        // Provide a local preview if consumer wants to show it
        if (onSuccess) {
          const previewUrl = URL.createObjectURL(croppedBlob);
          onSuccess(previewUrl);
        }
        return null;
      }

      setIsUploading(true);
      // Detect file extension based on blob type
      const fileExt = croppedBlob.type === "image/png" ? "png" :
                      croppedBlob.type === "image/webp" ? "webp" : "jpg";
      const fileName = `${authedUserId}/${pendingUploadData.path}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, croppedBlob, {
          contentType: croppedBlob.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(fileName);

      toast.success("Image uploaded successfully!");
      onSuccess?.(publicUrl);

      // Reset state
      setImageToEdit(null);
      setPendingUploadData(null);
      setQueuedBlob(null);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image. Please try again.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseCropper = () => {
    setImageToEdit(null);
    setPendingUploadData(null);
  };

  // Upload any queued blob after the user is authenticated
  const flushPendingUpload = async (forceUserId?: string, forcePath?: string) => {
    if (!queuedBlob) return null;

    const { data: { session } } = await supabase.auth.getSession();
    const authedUserId = forceUserId ?? session?.user?.id ?? null;
    if (!authedUserId) return null;

    const usedPath = forcePath ?? pendingUploadData?.path ?? 'profile';
    const fileExt = queuedBlob.type === 'image/png' ? 'png' : queuedBlob.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${authedUserId}/${usedPath}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, queuedBlob, {
        contentType: queuedBlob.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    onSuccess?.(publicUrl);

    // Reset queued state
    setQueuedBlob(null);
    setPendingUploadData(null);

    return publicUrl;
  };

  return {
    imageToEdit,
    isUploading,
    aspectRatioType,
    maxOutputSize,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper,
    flushPendingUpload,
  };
};
