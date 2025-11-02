import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BannerCarouselProps {
  bannerImage: string;
  galleryImages?: { image_url: string; description?: string }[];
  interval?: number;
  rating?: number;
}

export const BannerCarousel = ({ 
  bannerImage, 
  galleryImages = [], 
  interval = 5000,
  rating
}: BannerCarouselProps) => {
  // Combine banner with gallery images
  const allImages = [
    { image_url: bannerImage, description: 'Main Banner' },
    ...galleryImages
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextSlide = useCallback(() => {
    if (allImages.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
      setIsTransitioning(false);
    }, 500);
  }, [allImages.length]);

  const prevSlide = () => {
    if (allImages.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
      setIsTransitioning(false);
    }, 500);
  };

  const goToSlide = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 500);
  };

  // Auto-advance carousel only if there are gallery images
  useEffect(() => {
    if (allImages.length <= 1) return;
    
    const timer = setInterval(nextSlide, interval);
    return () => clearInterval(timer);
  }, [currentIndex, interval, nextSlide, allImages.length]);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg shadow-xl">
      {/* Rating Badge - Top Right */}
      {rating !== undefined && (
        <div className="absolute top-4 right-4 z-30 bg-black/50 backdrop-blur-md border border-white/30 rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-semibold text-sm">
            {rating > 0 ? rating.toFixed(1) : 'New'}
          </span>
        </div>
      )}

      {/* Images */}
      {allImages.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img 
            src={img.image_url} 
            alt={img.description || `Slide ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}


      {/* Dots Navigation - Only show if multiple images */}
      {allImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {allImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-8' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
