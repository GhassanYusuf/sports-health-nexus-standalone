import React, { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

// Enhanced styles for clear crop rectangle with dark overlay
const cropperStyles = {
  containerStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  cropAreaStyle: {
    border: '3px solid #ffffff',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
  },
};

export type AspectRatioType = "square" | "rectangle" | "circle" | "cover" | "4:3" | "16:9";

interface ImageCropperProps {
  image: string;
  aspectRatioType?: AspectRatioType;
  onCropComplete: (croppedImage: Blob) => void;
  onClose: () => void;
  maxOutputSize?: number; // Maximum dimension in pixels
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ 
  image, 
  aspectRatioType = "square",
  onCropComplete, 
  onClose,
  maxOutputSize = 2048 
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageFormat, setImageFormat] = useState<string>("image/png");
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [overrideAspect, setOverrideAspect] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaSize, setMediaSize] = useState<{ width: number; height: number } | null>(null);
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | undefined>(undefined);

  // Auto-detect image format and dimensions
  React.useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setOverrideAspect(null);
      setCropSize(undefined);
      
      // Detect if image is square-ish and auto-fit
      const aspectRatio = img.width / img.height;
      if (aspectRatioType === "square" && aspectRatio >= 0.9 && aspectRatio <= 1.1) {
        setZoom(1); // Full fit for square images
      } else {
        setZoom(0.5); // Start zoomed out for other images
      }
    };
    img.src = image;

    // Detect image format from data URL or file extension
    if (image.includes("data:image/png") || image.endsWith(".png")) {
      setImageFormat("image/png");
    } else if (image.includes("data:image/webp") || image.endsWith(".webp")) {
      setImageFormat("image/webp");
    } else {
      setImageFormat("image/jpeg");
    }
  }, [image, aspectRatioType]);

// Track container size
// Track container size
useEffect(() => {
  if (!containerRef.current) return;
  const el = containerRef.current;
  const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => ro.disconnect();
}, []);

// Keep a centered crop box that's smaller than the container for clear borders
useEffect(() => {
  if (!containerSize) return;
  const aspect = overrideAspect ?? getAspectRatio();
  const padding = 32; // px padding around
  const maxW = Math.max(0, containerSize.width - padding * 2);
  const maxH = Math.max(0, containerSize.height - padding * 2);
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  setCropSize({ width, height });
}, [containerSize, overrideAspect, aspectRatioType]);

// Determine aspect ratio based on type
  const getAspectRatio = () => {
    switch (aspectRatioType) {
      case "square":
      case "circle":
        return 1;
      case "rectangle":
      case "16:9":
        return 16 / 9;
      case "cover":
        return 21 / 9;
      case "4:3":
        return 4 / 3;
      default:
        return 1;
    }
  };

  const getCropShape = () => {
    return aspectRatioType === "circle" ? "round" : "rect";
  };

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<Blob> => {
    // Helpers
    const getRadianAngle = (deg: number) => (deg * Math.PI) / 180;
    const rotateSize = (width: number, height: number, rot: number) => {
      const rotRad = getRadianAngle(rot);
      return {
        width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
      };
    };

    const image = await createImage(imageSrc);

    // Create a canvas that will store the rotated image
    const rotBounding = rotateSize(image.width, image.height, rotation);
    const rotatedCanvas = document.createElement("canvas");
    const rCtx = rotatedCanvas.getContext("2d");
    if (!rCtx) throw new Error("No 2d context");

    rotatedCanvas.width = Math.round(rotBounding.width);
    rotatedCanvas.height = Math.round(rotBounding.height);

    // Move to center of canvas, rotate, then draw the image centered
    rCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rCtx.rotate(getRadianAngle(rotation));
    rCtx.drawImage(image, -image.width / 2, -image.height / 2);

    // Now extract the crop from the rotated image
    const cropCanvas = document.createElement("canvas");
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) throw new Error("No 2d context");

    // Respect maxOutputSize (downscale if needed, keep aspect)
    const targetW = pixelCrop.width;
    const targetH = pixelCrop.height;
    const needsDownscale = targetW > maxOutputSize || targetH > maxOutputSize;
    const scale = needsDownscale ? Math.min(maxOutputSize / targetW, maxOutputSize / targetH) : 1;

    const outW = Math.round(targetW * scale);
    const outH = Math.round(targetH * scale);

    cropCanvas.width = outW;
    cropCanvas.height = outH;

    // Draw the selected region from the rotated canvas to the output canvas
    // Source rect is pixelCrop mapped on the rotated image
    cropCtx.drawImage(
      rotatedCanvas,
      Math.round(pixelCrop.x),
      Math.round(pixelCrop.y),
      Math.round(pixelCrop.width),
      Math.round(pixelCrop.height),
      0,
      0,
      outW,
      outH
    );

    return new Promise((resolve) => {
      cropCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, imageFormat, imageFormat === "image/jpeg" ? 0.9 : 1);
    });
  };

const handleZoomToFit = () => {
  if (!mediaSize) return;

  // Determine target crop box (existing or computed from container)
  let targetWidth = cropSize?.width;
  let targetHeight = cropSize?.height;

  if (!targetWidth || !targetHeight) {
    const el = containerRef.current;
    if (!el) return;
    const padding = 32;
    const availableW = Math.max(0, el.clientWidth - padding * 2);
    const availableH = Math.max(0, el.clientHeight - padding * 2);
    const aspect = overrideAspect ?? getAspectRatio();
    let w = availableW;
    let h = w / aspect;
    if (h > availableH) {
      h = availableH;
      w = h * aspect;
    }
    targetWidth = w;
    targetHeight = h;
    setCropSize({ width: w, height: h });
  }

  // Compute zoom so the image width fits the crop box width
  const zoomFit = (targetWidth as number) / mediaSize.width;
  setZoom(zoomFit);
  setCrop({ x: 0, y: 0 });
};

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseOriginal = async () => {
    setIsProcessing(true);
    try {
      // Convert data URL to blob
      const response = await fetch(image);
      const blob = await response.blob();
      onCropComplete(blob);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop & Resize Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div ref={containerRef} className="relative h-96 bg-black rounded-lg overflow-hidden">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={overrideAspect ?? getAspectRatio()}
              cropShape={getCropShape()}
              onCropChange={setCrop}
              onCropComplete={onCropCompleteHandler}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              minZoom={0.1}
              maxZoom={3}
              cropSize={cropSize}
              restrictPosition
              onMediaLoaded={(ms) => setMediaSize({ width: ms.width, height: ms.height })}
              style={cropperStyles}
              showGrid={false}
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
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleZoomToFit}
                    disabled={!mediaSize}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Zoom to Fit
                  </Button>
                  <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
                </div>
              </div>
              <Slider value={[zoom]} min={0.1} max={3} step={0.1} onValueChange={(v) => setZoom(v[0])} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <RotateCw className="h-4 w-4" />
                  Rotation
                </Label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleUseOriginal} disabled={isProcessing}>
            Use Original
          </Button>
          <Button onClick={handleSave} disabled={isProcessing || !croppedAreaPixels}>
            {isProcessing ? "Processing..." : "Save & Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
