import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeInput12hProps {
  value: string; // 24-hour format HH:mm
  onChange: (value: string) => void; // Returns 24-hour format HH:mm
  className?: string;
  required?: boolean;
}

const convert24to12 = (time: string) => {
  if (!time || !time.includes(':')) {
    return { hours: '12', minutes: '00', period: 'AM' };
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    return { hours: '12', minutes: '00', period: 'AM' };
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return {
    hours: displayHours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    period,
  };
};

const convert12to24 = (hours: string, minutes: string, period: string) => {
  let hours24 = parseInt(hours);
  if (period === 'PM' && hours24 !== 12) hours24 += 12;
  if (period === 'AM' && hours24 === 12) hours24 = 0;
  return `${hours24.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

export const TimeInput12h: React.FC<TimeInput12hProps> = ({ 
  value, 
  onChange, 
  className,
  required 
}) => {
  const [localHours, setLocalHours] = useState('12');
  const [localMinutes, setLocalMinutes] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (value) {
      const converted = convert24to12(value);
      setLocalHours(converted.hours);
      setLocalMinutes(converted.minutes);
      setPeriod(converted.period as 'AM' | 'PM');
    }
  }, [value]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let hours = e.target.value.replace(/\D/g, '');
    if (hours.length > 2) hours = hours.slice(0, 2);
    
    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum)) {
      setLocalHours('');
      return;
    }
    if (hoursNum > 12) hours = '12';
    if (hoursNum < 1 && hours.length === 2) hours = '01';
    
    setLocalHours(hours);
    if (hours.length === 2 && localMinutes.length === 2) {
      onChange(convert12to24(hours, localMinutes, period));
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let minutes = e.target.value.replace(/\D/g, '');
    if (minutes.length > 2) minutes = minutes.slice(0, 2);
    
    const minutesNum = parseInt(minutes);
    if (isNaN(minutesNum)) {
      setLocalMinutes('');
      return;
    }
    if (minutesNum > 59) minutes = '59';
    
    setLocalMinutes(minutes);
    if (minutes.length === 2 && localHours.length === 2) {
      onChange(convert12to24(localHours, minutes, period));
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod as 'AM' | 'PM');
    if (localHours.length === 2 && localMinutes.length === 2) {
      onChange(convert12to24(localHours, localMinutes, newPeriod));
    }
  };

  const handleHoursBlur = () => {
    if (localHours.length === 1) {
      const paddedHours = localHours.padStart(2, '0');
      setLocalHours(paddedHours);
      onChange(convert12to24(paddedHours, localMinutes, period));
    }
  };

  const handleMinutesBlur = () => {
    if (localMinutes.length === 1) {
      const paddedMinutes = localMinutes.padStart(2, '0');
      setLocalMinutes(paddedMinutes);
      if (localHours.length === 2) {
        onChange(convert12to24(localHours, paddedMinutes, period));
      }
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="text"
        value={localHours}
        onChange={handleHoursChange}
        onBlur={handleHoursBlur}
        placeholder="12"
        className="w-12 text-center px-1"
        required={required}
        maxLength={2}
      />
      <span className="text-muted-foreground">:</span>
      <Input
        type="text"
        value={localMinutes}
        onChange={handleMinutesChange}
        onBlur={handleMinutesBlur}
        placeholder="00"
        className="w-12 text-center px-1"
        required={required}
        maxLength={2}
      />
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[70px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
