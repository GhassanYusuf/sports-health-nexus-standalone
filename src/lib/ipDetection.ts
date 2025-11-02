// Utility for IP-based country detection
export const detectCountryFromIP = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('IP detection failed');
    const data = await response.json();
    return data.country_code; // Returns ISO 2-letter country code (e.g., 'US', 'GB')
  } catch (error) {
    console.error('Failed to detect country from IP:', error);
    return null;
  }
};

// Utility for IP-based approximate coordinates detection (no API key required)
export const detectLatLngFromIP = async (): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('IP geolocation failed');
    const data = await response.json();
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return { lat: data.latitude, lng: data.longitude };
    }
    return null;
  } catch (error) {
    console.error('Failed to detect lat/lng from IP:', error);
    return null;
  }
};
