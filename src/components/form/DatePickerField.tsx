import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerFieldProps {
  value?: Date;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  error?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  buttonClassName?: string;
}

export function DatePickerField({
  value,
  onSelect,
  placeholder = "Pick a date",
  disabled,
  error,
  className,
  minDate = new Date("1900-01-01"),
  maxDate = new Date(),
  buttonClassName,
}: DatePickerFieldProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            error && "border-destructive",
            buttonClassName
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", className)} align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onSelect}
          disabled={disabled}
          fromYear={minDate.getFullYear()}
          toYear={maxDate.getFullYear()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
