import { Button } from "@/components/ui/button";
import { Instagram, Facebook, Mail, Phone, MessageCircle, Globe, Music, Camera } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LinkTreeItem {
  type?: string;
  title?: string;
  url: string;
  label?: string;
}

interface SocialMediaLinksProps {
  linkTree: LinkTreeItem[];
  clubPhone?: string;
  clubPhoneCode?: string;
  clubEmail?: string;
}

const formatWhatsAppLink = (phone: string, countryCode: string = '+1') => {
  // Remove all non-numeric characters
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanCode = countryCode.replace(/\D/g, '');
  return `https://wa.me/${cleanCode}${cleanPhone}`;
};

const formatInstagramLink = (url: string) => {
  // Handle various Instagram URL formats
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    return url;
  }
  // If just username provided
  if (!url.includes('http')) {
    const username = url.replace('@', '');
    return `https://www.instagram.com/${username}`;
  }
  return url;
};

const getLinkIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    instagram: Instagram,
    facebook: Facebook,
    email: Mail,
    phone: Phone,
    whatsapp: MessageCircle,
    website: Globe,
    tiktok: Music,
    snapchat: Camera,
  };
  return iconMap[type.toLowerCase()] || Globe;
};

const getLinkColor = (type: string) => {
  const colorMap: Record<string, string> = {
    instagram: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
    facebook: "bg-blue-600 hover:bg-blue-700",
    whatsapp: "bg-green-600 hover:bg-green-700",
    email: "bg-gray-600 hover:bg-gray-700",
    phone: "bg-primary hover:bg-primary-dark",
    website: "bg-secondary hover:bg-secondary-light",
    tiktok: "bg-black hover:bg-gray-900",
    snapchat: "bg-yellow-400 hover:bg-yellow-500",
  };
  return colorMap[type.toLowerCase()] || "bg-secondary hover:bg-secondary-light";
};

export const SocialMediaLinks = ({ linkTree, clubPhone, clubPhoneCode, clubEmail }: SocialMediaLinksProps) => {
  const deriveType = (link: LinkTreeItem) => {
    const raw = (link.type || link.title || '').toString().toLowerCase();
    if (raw) return raw;
    const u = (link.url || '').toLowerCase();
    if (u.includes('instagram')) return 'instagram';
    if (u.includes('wa.me') || u.includes('whatsapp')) return 'whatsapp';
    if (u.startsWith('mailto:')) return 'email';
    if (u.startsWith('tel:')) return 'phone';
    if (u.includes('facebook')) return 'facebook';
    if (u.includes('tiktok')) return 'tiktok';
    if (u.includes('snapchat')) return 'snapchat';
    return 'website';
  };

  const handleLinkClick = (link: LinkTreeItem) => {
    const type = deriveType(link);
    let formattedUrl = link.url;

    // Format specific link types
    if (type === 'whatsapp') {
      if (clubPhone && clubPhoneCode) {
        formattedUrl = formatWhatsAppLink(clubPhone, clubPhoneCode);
      } else if (link.url.includes('wa.me') || link.url.includes('whatsapp')) {
        formattedUrl = link.url;
      }
    } else if (type === 'instagram') {
      formattedUrl = formatInstagramLink(link.url);
    } else if (type === 'email') {
      formattedUrl = `mailto:${clubEmail || link.url.replace('mailto:', '')}`;
    } else if (type === 'phone') {
      const phoneVal = (clubPhone || link.url.replace('tel:', ''));
      formattedUrl = `tel:${phoneVal}`;
    }

    // Open link
    try {
      window.open(formattedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  if (!linkTree || linkTree.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">Contact information coming soon</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2 justify-center">
        {linkTree.map((link, index) => {
          const type = deriveType(link);
          const Icon = getLinkIcon(type);
          const colorClass = getLinkColor(type);
          const label = link.label || (link.title as string) || (type.charAt(0).toUpperCase() + type.slice(1));
          
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className={`w-8 h-8 rounded-full ${colorClass} text-white`}
                  onClick={() => handleLinkClick({ ...link, type })}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
