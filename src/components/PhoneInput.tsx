import React, { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "./SearchableSelect";
import countries from "world-countries";
import { detectCountryFromIP } from "@/lib/ipDetection";

interface PhoneInputProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneNumberChange: (phone: string) => void;
  compact?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  compact = false,
}) => {
  const countryOptions = countries
    .filter((c) => c.cca2 !== "IL") // Exclude Israel
    .map((c) => {
      const callingCode = c.idd.root ? c.idd.root + (c.idd.suffixes?.[0] || "") : "";
      return {
        code: c.cca2,
        name: c.name.common,
        flag: c.flag,
        callingCode,
      };
    })
    .filter((c) => c.callingCode)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Detect user's country from IP address
  useEffect(() => {
    if (!countryCode) {
      detectCountryFromIP().then((detectedCode) => {
        const detectedCountry = detectedCode 
          ? countryOptions.find(c => c.code === detectedCode)
          : countryOptions.find(c => c.code === 'US'); // fallback to US
        
        if (detectedCountry) {
          onCountryCodeChange(detectedCountry.callingCode);
        }
      });
    }
  }, []);

  const selectOptions = countryOptions.map(c => ({
    value: c.callingCode,
    label: compact ? c.callingCode : `${c.name} ${c.callingCode}`,
    icon: c.flag,
  }));

  const selectedOption = countryOptions.find(c => c.callingCode === countryCode);

  return (
    <div className="flex items-stretch gap-2">
      <div className={compact ? "w-[110px]" : "w-[200px]"}>
        <SearchableSelect
          value={countryCode}
          onValueChange={onCountryCodeChange}
          options={selectOptions}
          placeholder={compact ? "+1" : "Select country"}
          searchPlaceholder="Search countries..."
          emptyMessage="No country found."
        />
      </div>
      <Input
        type="tel"
        value={phoneNumber}
        onChange={(e) => onPhoneNumberChange(e.target.value)}
        placeholder="Phone number"
        className="flex-1"
      />
    </div>
  );
};
