import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { SocialMediaLinks } from "@/components/SocialMediaLinks";

interface OpeningHour {
  day_of_week: string;
  earliest_open: string;
  latest_close: string;
}

interface ClubAboutCardProps {
  description?: string;
  location?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  openingHours: OpeningHour[];
  linkTree?: any[];
  clubPhone?: string;
  clubPhoneCode?: string;
  clubEmail?: string;
}

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const isOpenNow = (hours: OpeningHour[]) => {
  const now = new Date();
  const currentDay = dayOrder[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const todayHours = hours.find((h) => h.day_of_week === currentDay);
  if (!todayHours) return false;

  const [openHour, openMin] = todayHours.earliest_open.split(":").map(Number);
  const [closeHour, closeMin] = todayHours.latest_close.split(":").map(Number);
  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  return currentTime >= openTime && currentTime <= closeTime;
};

export const ClubAboutCard = ({
  description,
  location,
  gpsLatitude,
  gpsLongitude,
  openingHours,
  linkTree = [],
  clubPhone,
  clubPhoneCode,
  clubEmail,
}: ClubAboutCardProps) => {
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const isOpen = openingHours.length > 0 && isOpenNow(openingHours);
  
  const now = new Date();
  const currentDay = dayOrder[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const todayHours = openingHours.find((h) => h.day_of_week === currentDay);
  const sortedHours = [...openingHours].sort(
    (a, b) => dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week)
  );

  const handleDirections = () => {
    if (gpsLatitude && gpsLongitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${gpsLatitude},${gpsLongitude}`,
        "_blank"
      );
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Description */}
        {description && (
          <p className="text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        {/* Location Section */}
        {location && (
          <div className="group rounded-lg bg-muted/30 hover:bg-muted/50 transition-all p-4 border border-transparent hover:border-primary/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Location</span>
                </div>
                <p className="text-sm text-muted-foreground pl-10">{location}</p>
              </div>
              {gpsLatitude && gpsLongitude && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDirections}
                  className="shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                >
                  Get Directions
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Opening Hours Section */}
        {openingHours.length > 0 && (
          <div className="group rounded-lg bg-muted/30 hover:bg-muted/50 transition-all p-4 border border-transparent hover:border-primary/20">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Opening Hours</span>
                </div>
                <Badge
                  className={
                    isOpen
                      ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
                      : "bg-gray-400 hover:bg-gray-500 text-white"
                  }
                >
                  {isOpen && (
                    <span className="mr-2 inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                  {isOpen ? "Open Now" : "Closed"}
                </Badge>
              </div>

              {todayHours && (
                <div className="bg-background/50 rounded-md p-3 pl-10">
                  <p className="text-sm font-medium text-foreground">
                    Today ({currentDay})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(todayHours.earliest_open)} - {formatTime(todayHours.latest_close)}
                  </p>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="pl-10 h-auto p-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent"
              >
                {showFullSchedule ? "Hide" : "View"} Weekly Schedule
                {showFullSchedule ? (
                  <ChevronUp className="ml-1 w-3 h-3" />
                ) : (
                  <ChevronDown className="ml-1 w-3 h-3" />
                )}
              </Button>

              {showFullSchedule && (
                <div className="space-y-1.5 pl-10 pt-2 animate-in slide-in-from-top-2">
                  {sortedHours.map((hour) => (
                    <div
                      key={hour.day_of_week}
                      className="flex justify-between text-xs py-1.5 px-2 rounded hover:bg-background/50 transition-colors"
                    >
                      <span className="font-medium text-foreground">
                        {hour.day_of_week}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTime(hour.earliest_open)} - {formatTime(hour.latest_close)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Get In Touch Section */}
        {(linkTree.length > 0 || clubPhone || clubEmail) && (
          <div className="group rounded-lg bg-muted/30 hover:bg-muted/50 transition-all p-4 border border-transparent hover:border-primary/20">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Get In Touch</span>
              </div>
              <div className="pl-10">
                <SocialMediaLinks
                  linkTree={linkTree}
                  clubPhone={clubPhone}
                  clubPhoneCode={clubPhoneCode}
                  clubEmail={clubEmail}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
