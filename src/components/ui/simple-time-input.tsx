import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SimpleTimeInputProps {
  value: string; // Expected format: "HH:MM AM/PM" or 24-hour "HH:MM"
  onChange: (value: string) => void; // Returns 24-hour format "HH:MM"
  className?: string;
  placeholder?: string;
}

const convert24to12 = (time: string): string => {
  if (!time || !time.includes(':')) return '09:00 AM';
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '09:00 AM';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const convert12to24 = (time12: string): string => {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12;
  
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

export const SimpleTimeInput: React.FC<SimpleTimeInputProps> = ({ 
  value, 
  onChange, 
  className,
  placeholder = "09:00 AM"
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value) {
      // Convert to 12-hour format for display
      const display = value.includes('M') ? value : convert24to12(value);
      setDisplayValue(display);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
  };

  const handleBlur = () => {
    // Try to parse and convert to 24-hour format
    const time24 = convert12to24(displayValue);
    onChange(time24);
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn("font-mono", className)}
    />
  );
};
