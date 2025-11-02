import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@/lib/currencyUtils";
import { useQueryClient } from "@tanstack/react-query";

interface ManualIncomeDialogProps {
  clubId: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ManualIncomeDialog({ clubId, currency, open, onOpenChange, onSuccess }: ManualIncomeDialogProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    source: '',
    notes: '',
    payment_method: 'cash'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.source) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Get club's VAT percentage
      const { data: club } = await supabase
        .from('clubs')
        .select('vat_percentage')
        .eq('id', clubId)
        .single();

      const amount = parseFloat(formData.amount);
      const vatPercentage = club?.vat_percentage || 0;

      // Create manual income transaction
      const { error } = await supabase.functions.invoke('create-transaction', {
        body: {
          club_id: clubId,
          transaction_type: 'product_sale', // Use product_sale for manual income
          description: `Manual Income: ${formData.source}`,
          amount: amount,
          vat_percentage_applied: vatPercentage,
          payment_method: formData.payment_method,
          transaction_date: formData.date,
          notes: formData.notes
        }
      });

      if (error) throw error;

      toast.success("Manual income recorded successfully");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        source: '',
        notes: '',
        payment_method: 'cash'
      });
    } catch (error: any) {
      console.error('Error recording manual income:', error);
      toast.error(error.message || "Failed to record manual income");
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Record Manual Income
          </DialogTitle>
          <DialogDescription>
            Add a manual income entry to your financial records
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-8"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              VAT will be calculated automatically based on club settings
            </p>
          </div>

          <div>
            <Label htmlFor="date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="source">
              Income Source <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source"
              placeholder="e.g., Equipment sale, Special event"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
            >
              <SelectTrigger id="payment_method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about this income..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Recording..." : "Record Income"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
