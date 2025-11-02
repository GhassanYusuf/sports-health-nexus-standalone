import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Baby, Plus, Loader2, Edit, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useToast } from "@/hooks/use-toast";

export default function MyChildren() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from('children')
      .select('*')
      .eq('parent_user_id', user.id)
      .order('name');

    if (data) {
      setChildren(data);
    }

    setLoading(false);
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Children</h1>
            <p className="text-muted-foreground">
              Manage your children's profiles and memberships
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Child
          </Button>
        </div>

        {/* Children Grid */}
        {children.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Baby className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Children Added</h3>
              <p className="text-muted-foreground mb-6">
                Add your children's profiles to enroll them in clubs
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Card key={child.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={child.avatar_url || undefined} />
                      <AvatarFallback className="bg-brand-red text-white text-xl">
                        {child.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{child.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {calculateAge(child.date_of_birth)} years old
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{child.gender}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nationality</p>
                      <p className="font-medium">{child.nationality}</p>
                    </div>
                    {child.blood_type && (
                      <div>
                        <p className="text-muted-foreground">Blood Type</p>
                        <p className="font-medium">{child.blood_type}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
