import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/ImageCropper";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ImageUploadCropperProps {
  onImageSelected: (file: File) => void;
  currentImageUrl?: string;
  label?: string;
  buttonText?: string;
  showImage?: boolean;
}

export const ImageUploadCropper: React.FC<ImageUploadCropperProps> = ({
  onImageSelected,
  currentImageUrl,
  label = "Upload Photo",
  buttonText,
  showImage = true,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    // Convert blob to File
    const file = new File([croppedBlob], "cropped-image.png", {
      type: croppedBlob.type,
    });
    onImageSelected(file);
    setShowCropper(false);
    setImageDataUrl(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      {showImage && currentImageUrl && (
        <div className="flex items-center gap-4 mb-3">
          <img
            src={currentImageUrl}
            alt="Preview"
            className="w-20 h-20 rounded-full object-cover border-2"
          />
        </div>
      )}

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={triggerFileInput}
      >
        <Upload className="mr-2 h-4 w-4" />
        {buttonText || (currentImageUrl ? "Change Photo" : label)}
      </Button>

      {showCropper && imageDataUrl && (
        <ImageCropper
          image={imageDataUrl}
          aspectRatioType="circle"
          onCropComplete={handleCropComplete}
          onClose={() => {
            setShowCropper(false);
            setImageDataUrl(null);
          }}
        />
      )}
    </div>
  );
};
