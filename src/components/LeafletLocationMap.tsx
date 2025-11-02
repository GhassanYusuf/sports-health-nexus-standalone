import React, { useEffect, useRef, useState } from "react";

interface LocationMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  onLocationChange: (lat: number, lng: number) => void;
  onZoomChange?: (zoom: number) => void;
  onAddressChange?: (address: string) => void;
  height?: number | string;
}

// Client-only Leaflet map loaded dynamically to avoid SSR/bundle issues
const LeafletLocationMap: React.FC<LocationMapProps> = ({
  latitude,
  longitude,
  zoom = 13,
  onLocationChange,
  onZoomChange,
  onAddressChange,
  height = 400,
}) => {
  const [leafletReady, setLeafletReady] = useState(false);
  const [L, setL] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [geoLocationError, setGeoLocationError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Get user's current location if coordinates not provided
  useEffect(() => {
    // If coordinates are provided from database, don't fetch geolocation
    if (latitude !== undefined && longitude !== undefined) {
      setCurrentLocation([latitude, longitude]);
      return;
    }

    // Try to get user's current location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setCurrentLocation(coords);
          // Notify parent component of the location
          onLocationChange(coords[0], coords[1]);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setGeoLocationError(error.message);
          // Fallback to default location (Bahrain)
          setCurrentLocation([26.0667, 50.5577]);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      setGeoLocationError('Geolocation not supported');
      // Fallback to default location
      setCurrentLocation([26.0667, 50.5577]);
    }
  }, [latitude, longitude]);

  // Lazy-load Leaflet and initialize a plain Leaflet map (no react-leaflet)
  useEffect(() => {
    if (!currentLocation) return; // Wait for location to be determined

    let mounted = true;
    let initTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 20; // Try for 2 seconds max

    const initMap = async () => {
      try {
        // Wait for container to be available
        if (!containerRef.current) {
          if (retryCount < maxRetries) {
            retryCount++;
            initTimeout = setTimeout(initMap, 100);
          } else {
            console.error("Map container never became available");
          }
          return;
        }

        // Check if container has dimensions
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          if (retryCount < maxRetries) {
            retryCount++;
            initTimeout = setTimeout(initMap, 100);
          }
          return;
        }

        const { default: Leaflet } = await import("leaflet");

        // Fix default icon paths
        delete (Leaflet.Icon.Default.prototype as any)._getIconUrl;
        Leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        if (!mounted || !containerRef.current) return;

        setL(Leaflet);

        // Create map with saved zoom level
        const map = Leaflet.map(containerRef.current).setView(currentLocation, zoom);

        // Use CartoDB Voyager tiles - colorful theme with English labels
        Leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        // Add DRAGGABLE marker
        const marker = Leaflet.marker(currentLocation, {
          draggable: true
        }).addTo(map);

        // Update coordinates when marker is dragged and perform reverse geocoding
        marker.on('dragend', async function(e: any) {
          const position = marker.getLatLng();
          onLocationChange(position.lat, position.lng);
          
          // Reverse geocoding to get address
          if (onAddressChange) {
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1&accept-language=en`
              );
              const data = await response.json();
              
              if (data && data.address) {
                const addr = data.address;
                const addressParts = [
                  addr.road || addr.pedestrian || addr.footway,
                  addr.neighbourhood || addr.suburb || addr.quarter,
                  addr.city || addr.town || addr.village,
                  addr.state || addr.province || addr.region,
                  addr.country
                ].filter(Boolean);
                
                const formattedAddress = addressParts.join(", ");
                onAddressChange(formattedAddress);
              }
            } catch (error) {
              console.error("Reverse geocoding error:", error);
            }
          }
        });

        // Track zoom changes
        map.on('zoomend', () => {
          const currentZoom = map.getZoom();
          if (onZoomChange) {
            onZoomChange(currentZoom);
          }
        });

        mapRef.current = map;
        markerRef.current = marker;
        setLeafletReady(true);
      } catch (e) {
        console.error("Failed to load Leaflet", e);
      }
    };

    initMap();

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      try {
        mapRef.current?.remove();
      } catch {}
    };
  }, [currentLocation]);

  // Update marker/center when location props change (from database)
  useEffect(() => {
    if (!leafletReady || !L || !mapRef.current || !markerRef.current) return;
    if (latitude === undefined || longitude === undefined) return;
    
    const next: [number, number] = [latitude, longitude];
    markerRef.current.setLatLng(next);
    // Use saved zoom level or keep current
    mapRef.current.setView(next, zoom);
  }, [leafletReady, L, latitude, longitude, zoom]);

  return (
    <div className="relative" style={{ height: typeof height === "number" ? `${height}px` : height }}>
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
        className="rounded-lg"
        aria-label="Location map"
      />
      {!leafletReady && (
        <div className="absolute inset-0 rounded-lg border flex items-center justify-center text-sm text-muted-foreground bg-background">
          {geoLocationError ? (
            <div className="text-center px-4">
              <p>Getting your location...</p>
              <p className="text-xs mt-1">{geoLocationError}</p>
            </div>
          ) : (
            "Loading map..."
          )}
        </div>
      )}
    </div>
  );
};

export default LeafletLocationMap;
