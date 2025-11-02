import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Gift, CheckCircle2, AlertCircle } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  discount_text: string;
  category: string;
  terms: string;
  requirements: string;
  contact_info: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

interface PartnerBenefitsModalProps {
  partner: Partner | null;
  isOpen: boolean;
  onClose: () => void;
  isActiveMember: boolean;
}

const categoryColors: Record<string, string> = {
  shop: "bg-blue-500",
  nutrition: "bg-green-500",
  physiotherapy: "bg-purple-500",
  supplements: "bg-orange-500",
  venues: "bg-pink-500",
  food_plans: "bg-teal-500",
};

const categoryIcons: Record<string, string> = {
  shop: "🏪",
  nutrition: "💪",
  physiotherapy: "🏥",
  supplements: "💊",
  venues: "🏢",
  food_plans: "🥗",
};

export const PartnerBenefitsModal = ({ partner, isOpen, onClose, isActiveMember }: PartnerBenefitsModalProps) => {
  if (!partner) return null;

  const handleContact = () => {
    if (partner.contact_info?.phone) {
      window.open(`tel:${partner.contact_info.phone}`, '_blank');
    } else if (partner.contact_info?.website) {
      window.open(partner.contact_info.website, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4 mb-4">
            {partner.logo_url && (
              <img 
                src={partner.logo_url} 
                alt={partner.name}
                className="w-20 h-20 object-contain rounded-lg border"
              />
            )}
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{partner.name}</DialogTitle>
              <div className="flex gap-2">
                <Badge 
                  className={`${categoryColors[partner.category] || 'bg-gray-500'} text-white`}
                >
                  {categoryIcons[partner.category]} {partner.category?.replace('_', ' ').toUpperCase()}
                </Badge>
                {isActiveMember && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Eligible
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {!isActiveMember && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Active Membership Required</p>
                <p className="text-sm text-muted-foreground">
                  This benefit is only available to members with active club memberships.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Benefit Summary */}
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
            <div className="flex items-start gap-3">
              <Gift className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Your Benefit</h3>
                <p className="text-lg font-bold text-primary">{partner.discount_text}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {partner.description && (
            <div>
              <h3 className="font-semibold text-lg mb-2">About</h3>
              <DialogDescription className="text-base">
                {partner.description}
              </DialogDescription>
            </div>
          )}

          {/* Requirements */}
          {partner.requirements && (
            <div>
              <h3 className="font-semibold text-lg mb-2">What to Bring</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <ul className="space-y-2">
                  {partner.requirements.split('\n').map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {partner.terms && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Terms & Conditions</h3>
              <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
                {partner.terms.split('\n').map((term, idx) => (
                  <p key={idx} className="mb-2 last:mb-0">{term}</p>
                ))}
              </div>
            </div>
          )}

          {/* Contact Info */}
          {partner.contact_info && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Contact Partner</h3>
              <div className="flex flex-wrap gap-2">
                {partner.contact_info.phone && (
                  <Button variant="outline" size="sm" onClick={() => window.open(`tel:${partner.contact_info.phone}`, '_blank')}>
                    📞 Call
                  </Button>
                )}
                {partner.contact_info.email && (
                  <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${partner.contact_info.email}`, '_blank')}>
                    ✉️ Email
                  </Button>
                )}
                {partner.contact_info.website && (
                  <Button variant="outline" size="sm" onClick={() => window.open(partner.contact_info.website, '_blank')}>
                    🌐 Website
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button 
            className="flex-1" 
            onClick={handleContact}
            disabled={!isActiveMember}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Contact Partner
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
