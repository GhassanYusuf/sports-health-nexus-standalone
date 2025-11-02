import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Eye, Waves, Users, Thermometer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppHeader } from "@/components/AppHeader";

const VirtualTour = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <FloatingBackButton fallbackRoute="/explore" />
      <div className="max-w-6xl mx-auto p-4 space-y-6">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Virtual Tour - PowerHouse Fitness</h1>
      </div>

      {/* Virtual Tour Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Gym Floor */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop"
                alt="Main Gym Floor"
                className="w-full h-64 object-cover rounded-t-lg"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-lg">
                <Button variant="floating" size="lg">
                  <Eye className="w-6 h-6 mr-2" />
                  View Main Gym Floor
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg">Main Gym Floor</h3>
              <p className="text-muted-foreground">State-of-the-art equipment and training areas</p>
            </div>
          </CardContent>
        </Card>

        {/* Swimming Pool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop"
                alt="Swimming Pool"
                className="w-full h-64 object-cover rounded-t-lg"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-lg">
                <Button variant="floating" size="lg">
                  <Waves className="w-6 h-6 mr-2" />
                  View Swimming Pool
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg">Swimming Pool</h3>
              <p className="text-muted-foreground">Olympic-size pool for all skill levels</p>
            </div>
          </CardContent>
        </Card>

        {/* Group Classes Studio */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop"
                alt="Group Classes Studio"
                className="w-full h-64 object-cover rounded-t-lg"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-lg">
                <Button variant="floating" size="lg">
                  <Users className="w-6 h-6 mr-2" />
                  View Classes Studio
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg">Group Classes Studio</h3>
              <p className="text-muted-foreground">Spacious studio for yoga, pilates, and group fitness</p>
            </div>
          </CardContent>
        </Card>

        {/* Spa & Sauna */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=400&fit=crop"
                alt="Spa and Sauna"
                className="w-full h-64 object-cover rounded-t-lg"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-lg">
                <Button variant="floating" size="lg">
                  <Thermometer className="w-6 h-6 mr-2" />
                  View Spa & Sauna
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg">Spa & Sauna</h3>
              <p className="text-muted-foreground">Recovery and relaxation facilities</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Virtual Tour Button */}
      <Card>
        <CardContent className="p-8 text-center">
          <Camera className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Complete 360° Virtual Experience</h2>
          <p className="text-muted-foreground mb-6">
            Take a comprehensive tour of our entire facility with our interactive 360° experience
          </p>
          <Button size="lg" className="px-8">
            <Camera className="w-5 h-5 mr-2" />
            Start Full Virtual Tour
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default VirtualTour;