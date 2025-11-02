import { useNavigate } from "react-router-dom";
import {
  Building2,
  Image,
  MapPin,
  Users,
  Dumbbell,
  Package,
  Settings,
  BarChart3,
  UserPlus,
  LayoutDashboard,
  Database,
  MessageSquare,
  ArrowLeft,
  Eye,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminSidebarProps {
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onExitToClubList?: () => void;
  className?: string;
  userRole?: 'super_admin' | 'business_owner' | 'admin';
}

const menuItems = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "details", title: "Club Details", icon: Building2 },
  { id: "gallery", title: "Gallery", icon: Image },
  { id: "facilities", title: "Facilities", icon: MapPin },
  { id: "instructors", title: "Instructors", icon: Users },
  { id: "activities", title: "Activities", icon: Dumbbell },
  { id: "packages", title: "Packages", icon: Package },
  { id: "members", title: "Members", icon: UserPlus },
  { id: "financials", title: "Financials", icon: DollarSign },
  { id: "messages", title: "Messages", icon: MessageSquare },
  { id: "analytics", title: "Analytics", icon: BarChart3 },
];

export function AdminSidebar({ clubId, clubName, clubLogoUrl, activeSection, onSectionChange, onExitToClubList, className, userRole }: AdminSidebarProps) {
  const { open } = useSidebar();
  const navigate = useNavigate();

  const handleItemClick = (itemId: string) => {
    if (itemId === "database-backup") {
      navigate("/database-backup-restore");
    } else {
      onSectionChange(itemId);
    }
  };

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarContent className="pt-4 md:pt-0">
        <SidebarGroup>
          {open && clubLogoUrl ? (
            <div className="w-full px-4 pt-6 pb-4 flex items-center justify-center">
              <img 
                src={clubLogoUrl} 
                alt={clubName}
                className="w-full h-auto max-h-48 object-contain"
              />
            </div>
          ) : (
            <SidebarGroupLabel className="text-lg font-bold px-4 py-3">
              {open && clubName}
            </SidebarGroupLabel>
          )}
          
          {/* Action Buttons */}
          <div className="border-b border-border pb-3 mb-3 px-2">
            <TooltipProvider>
              <div className="flex items-center justify-center gap-2">
                {onExitToClubList && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 hover:bg-accent"
                        onClick={onExitToClubList}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Back to Clubs</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-9 w-9 hover:bg-accent"
                      onClick={() => window.open(`/club/${clubId}`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview Club</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => handleItemClick(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.title}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
