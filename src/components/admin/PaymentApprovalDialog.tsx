import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ImageCropper } from "@/components/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";
import { CheckCircle, XCircle, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currencyUtils";

interface PaymentApprovalDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currency?: string;
}

export function PaymentApprovalDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
  currency = 'USD'
}: PaymentApprovalDialogProps) {
  const [paymentProofUrl, setPaymentProofUrl] = useState(transaction?.payment_proof_url || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
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
    onSuccess: (url) => setPaymentProofUrl(url)
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await handleFileSelect(file, session.user.id, `payment-proof-${transaction.id}`);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    setAction('approve');
    try {
      console.log('🟢 Starting payment approval for transaction:', transaction.id);

      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      console.log('🔑 Got session, calling approve-payment function');

      const { data, error } = await supabase.functions.invoke('approve-payment', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          transaction_id: transaction.id,
          payment_proof_url: paymentProofUrl,
          notes
        }
      });

      console.log('📝 Approval response:', { data, error });

      if (error) {
        console.error('❌ Approval error:', error);
        throw new Error(error.message || 'Failed to approve payment');
      }

      toast.success('Payment approved successfully');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      console.log('✅ Calling onSuccess callback');
      onSuccess();
    } catch (error: any) {
      console.error('💥 Error approving payment:', error);
      toast.error(error.message || 'Failed to approve payment');
    } finally {
      setIsProcessing(false);
      setAction(null);
      console.log('🏁 Payment approval process completed');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setIsProcessing(true);
    setAction('reject');
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('reject-payment', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          transaction_id: transaction.id,
          rejection_reason: rejectionReason
        }
      });

      if (error) throw new Error(error.message || 'Failed to reject payment');

      toast.success('Payment rejected');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess();
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      toast.error(error.message || 'Failed to reject payment');
    } finally {
      setIsProcessing(false);
      setAction(null);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Approval</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Transaction Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Receipt #</p>
                <p className="font-medium">{transaction.receipt_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{formatCurrency(parseFloat(transaction.total_amount), { currency })}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{transaction.description}</p>
              </div>
              {transaction.member_name && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Member</p>
                  <p className="font-medium">{transaction.member_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Proof Upload */}
          <div>
            <Label>Payment Proof {!paymentProofUrl && <span className="text-destructive">*</span>}</Label>
            {paymentProofUrl && (
              <div className="mb-2">
                <img src={paymentProofUrl} alt="Payment proof" className="max-w-full h-auto rounded-lg border" />
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
              {paymentProofUrl ? 'Update payment proof if needed' : 'Upload payment proof to approve'}
            </p>
          </div>

          {/* Approval Notes */}
          <div>
            <Label htmlFor="approval-notes">Notes (Optional)</Label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {/* Rejection Reason */}
          <div>
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Required if rejecting payment..."
              rows={3}
            />
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
            variant="destructive"
            onClick={handleReject}
            disabled={isProcessing || !rejectionReason.trim()}
            className="gap-2"
          >
            {isProcessing && action === 'reject' ? (
              <>Processing...</>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Reject
              </>
            )}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing || !paymentProofUrl}
            className="gap-2"
          >
            {isProcessing && action === 'approve' ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Approve
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