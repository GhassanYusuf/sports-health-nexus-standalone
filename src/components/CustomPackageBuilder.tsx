import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Users, AlertTriangle, Sparkles, CheckCircle, DollarSign, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AIAdvisorChat from './AIAdvisorChat';
import { FloatingBackButton } from "@/components/ui/floating-back-button";

interface ActivitySchedule {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface Facility {
  id: string;
  name: string;
  address: string;
}

interface Activity {
  id: string;
  title: string;
  monthly_fee: number;
  sessions_per_week: number;
  notes: string | null;
  picture_url: string | null;
  facility: Facility;
  schedules: ActivitySchedule[];
}

interface Instructor {
  id: string;
  name: string;
  specialty: string;
}

interface CustomPackageBuilderProps {
  clubId: string;
  onBack: () => void;
  currency?: string;
}

const CustomPackageBuilder: React.FC<CustomPackageBuilderProps> = ({ clubId, onBack, currency }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<Record<string, string>>({});
  const [userGender, setUserGender] = useState<'male' | 'female' | ''>('');
  const [packageName, setPackageName] = useState('');
  const [goals, setGoals] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const formatCurrency = (amount: number) => {
    const hasDecimals = amount % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(amount);
  };

  useEffect(() => {
    fetchActivitiesAndInstructors();
  }, [clubId]);

  const fetchActivitiesAndInstructors = async () => {
    try {
      setLoading(true);

      // Fetch activities with their schedules and facilities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select(`
          id,
          title,
          monthly_fee,
          sessions_per_week,
          notes,
          picture_url,
          facility:facilities!inner(
            id,
            name,
            address
          )
        `)
        .eq('club_id', clubId);

      if (activitiesError) throw activitiesError;

      // Fetch schedules for all activities
      const activityIds = activitiesData?.map(a => a.id) || [];
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('activity_schedules')
        .select('*')
        .in('activity_id', activityIds);

      if (schedulesError) throw schedulesError;

      // Combine activities with their schedules
      const activitiesWithSchedules: Activity[] = (activitiesData || []).map(activity => ({
        ...activity,
        facility: Array.isArray(activity.facility) ? activity.facility[0] : activity.facility,
        schedules: schedulesData?.filter(s => s.activity_id === activity.id) || []
      }));

      setActivities(activitiesWithSchedules);

      // Fetch instructors
      const { data: instructorsData, error: instructorsError } = await supabase
        .from('club_instructors')
        .select('id, name, specialty')
        .eq('club_id', clubId);

      if (instructorsError) throw instructorsError;

      setInstructors(instructorsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load activities and instructors');
    } finally {
      setLoading(false);
    }
  };

  // Check for schedule conflicts
  const checkScheduleConflicts = (activityIds: string[]) => {
    const selectedActivitiesData = activities.filter(a => activityIds.includes(a.id));
    const allSessions: { 
      day: string; 
      startTime: string; 
      endTime: string; 
      activityName: string 
    }[] = [];
    
    selectedActivitiesData.forEach(activity => {
      activity.schedules.forEach(schedule => {
        allSessions.push({
          day: schedule.day_of_week,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          activityName: activity.title
        });
      });
    });

    const conflictPairs: string[] = [];
    for (let i = 0; i < allSessions.length; i++) {
      for (let j = i + 1; j < allSessions.length; j++) {
        if (allSessions[i].day === allSessions[j].day) {
          // Check if time ranges overlap
          const start1 = allSessions[i].startTime;
          const end1 = allSessions[i].endTime;
          const start2 = allSessions[j].startTime;
          const end2 = allSessions[j].endTime;
          
          if ((start1 < end2 && end1 > start2)) {
            conflictPairs.push(
              `${allSessions[i].activityName} and ${allSessions[j].activityName} both scheduled on ${allSessions[i].day} with overlapping times`
            );
          }
        }
      }
    }

    return conflictPairs;
  };

  const getAvailableActivities = () => {
    return activities;
  };

  const handleActivityToggle = (activityId: string) => {
    const newSelection = selectedActivities.includes(activityId)
      ? selectedActivities.filter(id => id !== activityId)
      : [...selectedActivities, activityId];
    
    setSelectedActivities(newSelection);
    setConflicts(checkScheduleConflicts(newSelection));
  };

  const calculateTotalPrice = () => {
    const selectedActivitiesData = activities.filter(a => selectedActivities.includes(a.id));
    const basePrice = selectedActivitiesData.reduce((sum, activity) => sum + Number(activity.monthly_fee), 0);
    const discount = selectedActivities.length > 2 ? 0.15 : 0;
    return Math.round(basePrice * (1 - discount));
  };

  const canCreatePackage = () => {
    const allHaveInstructors = selectedActivities.every(actId => selectedInstructors[actId]);
    return selectedActivities.length > 0 && 
           conflicts.length === 0 && 
           packageName.trim() !== '' &&
           allHaveInstructors;
  };

  const handleCreatePackage = async () => {
    try {
      toast.success('Package created successfully!');
      onBack();
    } catch (error) {
      console.error('Error creating package:', error);
      toast.error('Failed to create package');
    }
  };

  const availableActivities = getAvailableActivities();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FloatingBackButton />
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Build Your Custom Package</h2>
        <p className="text-muted-foreground">Create a personalized fitness package that fits your schedule and goals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Package Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="packageName">Package Name</Label>
                <Input
                  id="packageName"
                  placeholder="e.g., My Fitness Journey"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="goals">Your Fitness Goals (Optional)</Label>
                <Textarea
                  id="goals"
                  placeholder="e.g., Build strength, lose weight, learn self-defense..."
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Activity Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Activities</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAIChat(true)}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Get AI Help
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availableActivities.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No activities available yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Activities need to be created by the club administrator first.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableActivities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className={`flex items-start space-x-3 p-4 border rounded-lg transition-all ${
                      selectedActivities.includes(activity.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      id={activity.id}
                      checked={selectedActivities.includes(activity.id)}
                      onCheckedChange={() => handleActivityToggle(activity.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label htmlFor={activity.id} className="font-medium cursor-pointer">
                            {activity.title}
                          </label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.notes || 'No description available'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(activity.monthly_fee)}/month
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {activity.facility.name}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {activity.sessions_per_week}x/week
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Schedule */}
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Schedule:</p>
                        <div className="flex flex-wrap gap-1">
                          {activity.schedules.map((schedule, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {schedule.day_of_week} {schedule.start_time}-{schedule.end_time}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Instructor Selection */}
                      {selectedActivities.includes(activity.id) && (
                        <div className="mt-3">
                          <Label htmlFor={`instructor-${activity.id}`} className="text-xs">
                            Select Instructor
                          </Label>
                          <Select
                            value={selectedInstructors[activity.id] || ''}
                            onValueChange={(value) => setSelectedInstructors(prev => ({
                              ...prev,
                              [activity.id]: value
                            }))}
                          >
                            <SelectTrigger id={`instructor-${activity.id}`} className="mt-1">
                              <SelectValue placeholder="Choose an instructor" />
                            </SelectTrigger>
                            <SelectContent>
                              {instructors.map((instructor) => (
                                <SelectItem key={instructor.id} value={instructor.id}>
                                  {instructor.name} - {instructor.specialty}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conflicts Alert */}
          {conflicts.length > 0 && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-destructive">Schedule Conflicts Detected</h4>
                    <ul className="text-sm text-destructive mt-2 space-y-1">
                      {conflicts.map((conflict, idx) => (
                        <li key={idx}>• {conflict}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Panel */}
        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Package Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {packageName && (
                <div>
                  <p className="font-semibold">{packageName}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Selected Activities:</p>
                {selectedActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities selected</p>
                ) : (
                  <div className="space-y-2">
                     {selectedActivities.map(id => {
                       const activity = activities.find(a => a.id === id);
                       const instructor = instructors.find(i => i.id === selectedInstructors[id]);
                       return activity ? (
                         <div key={id} className="text-sm p-2 bg-accent/50 rounded space-y-1">
                           <div className="font-medium">{activity.title}</div>
                           {instructor && (
                             <div className="text-xs text-muted-foreground">
                               Instructor: {instructor.name}
                             </div>
                           )}
                         </div>
                       ) : null;
                     })}
                  </div>
                )}
              </div>

              {selectedActivities.length > 0 && (
                <div>
                  <div className="flex justify-between items-center pt-4 border-t">
                    <span className="font-semibold">Total Price:</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(calculateTotalPrice())}
                      <span className="text-sm text-muted-foreground">/month</span>
                    </span>
                  </div>
                  {selectedActivities.length > 2 && (
                    <p className="text-xs text-success">15% multi-activity discount applied!</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {packageName.trim() ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  Package named
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {selectedActivities.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  Activities selected
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {selectedActivities.every(actId => selectedInstructors[actId]) && selectedActivities.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  Instructors assigned
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {conflicts.length === 0 && selectedActivities.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  No schedule conflicts
                </div>
              </div>

              <Button 
                className="w-full" 
                disabled={!canCreatePackage()}
                onClick={handleCreatePackage}
              >
                Create Package
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">AI Package Assistant</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAIChat(false)}>
                ×
              </Button>
            </div>
            <div className="h-96">
              <AIAdvisorChat 
                context={{
                  userGender,
                  goals,
                  availableActivities,
                  selectedActivities,
                  conflicts
                }}
                onActivityRecommendation={(activityIds: string[]) => {
                  setSelectedActivities(activityIds);
                  setConflicts(checkScheduleConflicts(activityIds));
                  setShowAIChat(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomPackageBuilder;