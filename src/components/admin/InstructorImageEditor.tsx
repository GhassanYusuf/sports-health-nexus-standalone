import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import Cropper from "react-easy-crop";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface InstructorImageEditorProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImageUrl: string) => void;
}

export const InstructorImageEditor: React.FC<InstructorImageEditorProps> = ({
  imageUrl,
  isOpen,
  onClose,
  onSave,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any,
    rotation = 0
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    
    // Create a canvas for rotation
    const rotationCanvas = document.createElement("canvas");
    const rotationCtx = rotationCanvas.getContext("2d");

    if (!rotationCtx) {
      throw new Error("No 2d context");
    }

    // Calculate size for rotation
    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    rotationCanvas.width = safeArea;
    rotationCanvas.height = safeArea;

    // Draw rotated image
    rotationCtx.translate(safeArea / 2, safeArea / 2);
    rotationCtx.rotate((rotation * Math.PI) / 180);
    rotationCtx.translate(-safeArea / 2, -safeArea / 2);
    rotationCtx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    // Create final canvas with exact crop dimensions
    const finalCanvas = document.createElement("canvas");
    const finalCtx = finalCanvas.getContext("2d");
    
    if (!finalCtx) {
      throw new Error("No 2d context");
    }

    finalCanvas.width = pixelCrop.width;
    finalCanvas.height = pixelCrop.height;

    // Draw the cropped area directly from rotation canvas to final canvas
    finalCtx.drawImage(
      rotationCanvas,
      safeArea / 2 - image.width * 0.5 + pixelCrop.x, // source x
      safeArea / 2 - image.height * 0.5 + pixelCrop.y, // source y
      pixelCrop.width,  // source width
      pixelCrop.height, // source height
      0, // destination x
      0, // destination y
      pixelCrop.width,  // destination width
      pixelCrop.height  // destination height
    );

    return finalCanvas.toDataURL("image/jpeg", 0.9);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageUrl, croppedAreaPixels, rotation);
      onSave(croppedImage);
      onClose();
    } catch (e) {
      console.error("Error cropping image:", e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative h-96 bg-muted rounded-lg">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
            />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <ZoomOut className="h-4 w-4" />
                  Zoom
                  <ZoomIn className="h-4 w-4" />
                </Label>
                <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <RotateCw className="h-4 w-4" />
                  Rotation
                </Label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={(value) => setRotation(value[0])}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
