import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { RefreshCw, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface RefundDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currency?: string;
}

export function RefundDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
  currency = 'USD'
}: RefundDialogProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundProofUrl, setRefundProofUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    imageToEdit,
    isUploading,
    handleFileSelect,
    handleCropComplete,
    handleCloseCropper
  } = useImageUpload({
    bucket: 'avatars',
    onSuccess: (url) => setRefundProofUrl(url)
  });

  const originalAmount = parseFloat(transaction?.total_amount || 0);
  const calculatedRefund = refundType === 'full' ? originalAmount : parseFloat(refundAmount || '0');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await handleFileSelect(file, session.user.id, `refund-proof-${transaction.id}`);
    }
  };

  const handleRefund = async () => {
    if (!refundReason.trim()) {
      toast.error('Please provide a refund reason');
      return;
    }

    if (refundType === 'partial' && (!refundAmount || parseFloat(refundAmount) <= 0)) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    if (calculatedRefund > originalAmount) {
      toast.error('Refund amount cannot exceed original transaction amount');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🟢 Starting refund process for transaction:', transaction.id);

      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      console.log('🔑 Got session, calling create-refund function');

      const { data, error } = await supabase.functions.invoke('create-refund', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          original_transaction_id: transaction.id,
          refund_amount: calculatedRefund,
          refund_reason: refundReason,
          refund_proof_url: refundProofUrl,
          is_full_refund: refundType === 'full'
        }
      });

      console.log('📝 Refund response:', { data, error });

      if (error) {
        console.error('❌ Refund error:', error);
        // Extract the actual error message from the Edge Function response
        let errorMessage = (data as any)?.error;

        if (!errorMessage && (error as any).context) {
          try {
            const response = (error as any).context as Response;
            const responseClone = response.clone();
            const errorData = await responseClone.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
          }
        }

        if (!errorMessage) {
          errorMessage = error.message || 'Failed to process refund';
        }

        throw new Error(errorMessage);
      }

      toast.success(`${refundType === 'full' ? 'Full' : 'Partial'} refund processed successfully`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      console.log('✅ Calling onSuccess callback');
      onSuccess();
    } catch (error: any) {
      console.error('💥 Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setIsProcessing(false);
      console.log('🏁 Refund process completed');
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Original Transaction</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Receipt #</p>
                <p className="font-medium">{transaction.receipt_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Original Amount</p>
                <p className="font-medium">{formatCurrency(originalAmount, { currency })}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{transaction.description}</p>
              </div>
            </div>
          </div>

          {/* Refund Type */}
          <div>
            <Label>Refund Type</Label>
            <RadioGroup value={refundType} onValueChange={(value: any) => setRefundType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">
                  Full Refund ({formatCurrency(originalAmount, { currency })})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="font-normal cursor-pointer">
                  Partial Refund
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Partial Refund Amount */}
          {refundType === 'partial' && (
            <div>
              <Label htmlFor="refund-amount">
                Refund Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={originalAmount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Max: ${formatCurrency(originalAmount, { currency })}`}
              />
            </div>
          )}

          {/* Refund Impact */}
          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100">Refund Impact</h4>
            <div className="text-sm space-y-1 text-orange-800 dark:text-orange-200">
              <p>• Original Income: +{formatCurrency(originalAmount, { currency })}</p>
              <p>• Refund Amount: -{formatCurrency(calculatedRefund, { currency })}</p>
              <p className="font-semibold pt-1 border-t border-orange-200 dark:border-orange-800">
                Net Income Impact: {formatCurrency(originalAmount - calculatedRefund, { currency })}
              </p>
            </div>
          </div>

          {/* Refund Reason */}
          <div>
            <Label htmlFor="refund-reason">
              Refund Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain the reason for this refund..."
              rows={3}
              required
            />
          </div>

          {/* Refund Proof */}
          <div>
            <Label>Refund Proof (Optional)</Label>
            {refundProofUrl && (
              <div className="mb-2">
                <img src={refundProofUrl} alt="Refund proof" className="max-w-full h-auto rounded-lg border" />
              </div>
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
              ref={fileInputRef}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload proof of refund transaction if available
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={isProcessing || !refundReason.trim() || (refundType === 'partial' && !refundAmount)}
            variant="destructive"
            className="gap-2"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Process Refund
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {imageToEdit && (
        <ImageCropper
          image={imageToEdit}
          aspectRatioType="16:9"
          onCropComplete={handleCropComplete}
          onClose={handleCloseCropper}
          maxOutputSize={2048}
        />
      )}
    </Dialog>
  );
}