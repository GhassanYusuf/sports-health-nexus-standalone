import { getCountryOptions } from "@/lib/countryUtils";
import { SearchableSelect } from "./SearchableSelect";

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function CountrySelector({
  value,
  onValueChange,
  placeholder = "Select country",
}: CountrySelectorProps) {
  const countryOptions = getCountryOptions();

  const selectOptions = countryOptions.map((country) => ({
    value: country.value,
    label: `${country.flag} ${country.label} (${country.value})`,
  }));

  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      options={selectOptions}
      placeholder={placeholder}
    />
  );
}
