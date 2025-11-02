import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";

interface OpeningHour {
  day_of_week: string;
  earliest_open: string;
  latest_close: string;
}

interface OpeningHoursDisplayProps {
  hours: OpeningHour[];
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const isOpenNow = (hours: OpeningHour[]) => {
  const now = new Date();
  const currentDay = dayOrder[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = now.toTimeString().slice(0, 5);

  const todayHours = hours.find(h => h.day_of_week === currentDay);
  if (!todayHours) return false;

  return currentTime >= todayHours.earliest_open && currentTime <= todayHours.latest_close;
};

export const OpeningHoursDisplay = ({ hours }: OpeningHoursDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOpen = isOpenNow(hours);
  const now = new Date();
  const currentDay = dayOrder[now.getDay() === 0 ? 6 : now.getDay() - 1];
  
  const sortedHours = [...hours].sort((a, b) => {
    return dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
  });

  const todayHours = sortedHours.find(h => h.day_of_week === currentDay);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Opening Hours</h3>
        </div>
        <Badge variant={isOpen ? "default" : "secondary"} className={isOpen ? "bg-green-600" : ""}>
          {isOpen ? "Open Now" : "Closed"}
        </Badge>
      </div>

      {todayHours && (
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <p className="text-sm text-muted-foreground">Today ({currentDay})</p>
          <p className="text-lg font-semibold">
            {formatTime(todayHours.earliest_open)} - {formatTime(todayHours.latest_close)}
          </p>
        </div>
      )}

      {sortedHours.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? (
              <>
                Hide Weekly Schedule <ChevronUp className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                View Weekly Schedule <ChevronDown className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="space-y-2 pt-2 border-t">
              {sortedHours.map((hour) => (
                <div
                  key={hour.day_of_week}
                  className={`flex justify-between items-center p-2 rounded ${
                    hour.day_of_week === currentDay ? 'bg-primary/10' : 'bg-muted/30'
                  }`}
                >
                  <span className={`font-medium ${hour.day_of_week === currentDay ? 'text-primary' : ''}`}>
                    {hour.day_of_week}
                  </span>
                  <span className="text-sm">
                    {formatTime(hour.earliest_open)} - {formatTime(hour.latest_close)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sortedHours.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Hours vary by facility and activity
        </p>
      )}
    </div>
  );
};
