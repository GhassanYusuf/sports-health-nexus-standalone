import countries from "world-countries";

export interface CountryData {
  currency: string;
  timezone: string;
  phoneCode: string;
  flag: string;
  name: string;
}

// Mapping for common timezone overrides (using capital city timezones)
const timezoneOverrides: Record<string, string> = {
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  BR: "America/Sao_Paulo",
  RU: "Europe/Moscow",
  MX: "America/Mexico_City",
  GB: "Europe/London",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  GR: "Europe/Athens",
  PT: "Europe/Lisbon",
  CN: "Asia/Shanghai",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  IN: "Asia/Kolkata",
  ID: "Asia/Jakarta",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  PH: "Asia/Manila",
  MY: "Asia/Kuala_Lumpur",
  SG: "Asia/Singapore",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  EG: "Africa/Cairo",
  ZA: "Africa/Johannesburg",
  KE: "Africa/Nairobi",
  NG: "Africa/Lagos",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
  PE: "America/Lima",
  NZ: "Pacific/Auckland",
  BH: "Asia/Bahrain",
  KW: "Asia/Kuwait",
  QA: "Asia/Qatar",
  OM: "Asia/Muscat",
  JO: "Asia/Amman",
  LB: "Asia/Beirut",
};

export function getCountryData(isoCode: string): CountryData | null {
  const country = countries.find(
    (c) => c.cca2.toLowerCase() === isoCode.toLowerCase()
  );

  if (!country) return null;

  // Get primary currency
  const currencyCodes = Object.keys(country.currencies || {});
  const currency = currencyCodes[0] || "USD";

  // Get timezone (prefer override, then UTC as fallback)
  const timezone = timezoneOverrides[country.cca2] || "UTC";

  // Get phone code
  const phoneCode =
    country.idd && country.idd.root
      ? `${country.idd.root}${country.idd.suffixes?.[0] || ""}`
      : "+1";

  return {
    currency,
    timezone,
    phoneCode,
    flag: country.flag,
    name: country.name.common,
  };
}

export interface CountryOption {
  value: string;
  label: string;
  flag: string;
}

export function getCountryOptions(): CountryOption[] {
  return countries
    .filter((c) => c.cca2 !== "IL") // Filter out Israel as per existing pattern
    .map((country) => ({
      value: country.cca2,
      label: country.name.common,
      flag: country.flag,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
