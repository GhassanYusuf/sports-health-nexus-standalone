import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FileText, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PaymentApprovalDialog } from "./PaymentApprovalDialog";
import { RefundDialog } from "./RefundDialog";
import { formatCurrency } from "@/lib/currencyUtils";

interface TransactionDetailDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionUpdated: () => void;
  currency?: string;
}

export function TransactionDetailDialog({
  transaction,
  open,
  onOpenChange,
  onTransactionUpdated,
  currency = 'USD'
}: TransactionDetailDialogProps) {
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);

  if (!transaction) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string }> = {
      paid: { variant: "default", className: "bg-green-500" },
      pending: { variant: "secondary", className: "bg-orange-500" },
      rejected: { variant: "destructive", className: "" }
    };
    
    return (
      <Badge variant={variants[status]?.variant || "outline"} className={variants[status]?.className}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Transaction Details</span>
              {getStatusBadge(transaction.payment_status)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Receipt Information */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Receipt Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Receipt Number</p>
                  <p className="font-medium">{transaction.receipt_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transaction Date</p>
                  <p className="font-medium">
                    {format(new Date(transaction.transaction_date), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transaction Type</p>
                  <p className="font-medium capitalize">{transaction.transaction_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">{transaction.payment_method}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Member Information */}
            {transaction.member_name && (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Member Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{transaction.member_name}</p>
                    </div>
                    {transaction.member_email && (
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{transaction.member_email}</p>
                      </div>
                    )}
                    {transaction.member_phone && (
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{transaction.member_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Transaction Details */}
            <div>
              <h3 className="font-semibold mb-2">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{transaction.description}</p>
                </div>
                {transaction.notes && (
                  <div>
                    <p className="text-muted-foreground">Notes</p>
                    <p className="font-medium">{transaction.notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(parseFloat(transaction.amount), { currency })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">VAT ({transaction.vat_percentage_applied}%)</p>
                    <p className="font-medium">{formatCurrency(parseFloat(transaction.vat_amount || 0), { currency })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">{formatCurrency(parseFloat(transaction.total_amount), { currency })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Proof */}
            {(transaction.payment_proof_url || transaction.payment_screenshot_url) && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Payment Proof</h3>
                  <img
                    src={transaction.payment_proof_url || transaction.payment_screenshot_url}
                    alt="Payment proof"
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              </>
            )}

            {/* Approval Information */}
            {transaction.approved_by && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Approval Information</h3>
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      Approved on {format(new Date(transaction.approved_at), 'PPP p')}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Rejection Information */}
            {transaction.rejection_reason && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 text-destructive">Rejection Information</h3>
                  <p className="text-sm">{transaction.rejection_reason}</p>
                </div>
              </>
            )}

            {/* Refund Information */}
            {transaction.is_refund && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Refund Information</h3>
                  <div className="text-sm space-y-2">
                    <div>
                      <p className="text-muted-foreground">Refund Amount</p>
                      <p className="font-medium text-destructive">
                        {formatCurrency(parseFloat(transaction.refund_amount || 0), { currency })}
                      </p>
                    </div>
                    {transaction.refund_proof_url && (
                      <div>
                        <p className="text-muted-foreground mb-2">Refund Proof</p>
                        <img
                          src={transaction.refund_proof_url}
                          alt="Refund proof"
                          className="max-w-full h-auto rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex gap-2 justify-end">
              {transaction.payment_status === 'pending' && (
                <>
                  <Button
                    onClick={() => setShowApprovalDialog(true)}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve Payment
                  </Button>
                </>
              )}
              {transaction.payment_status === 'paid' && !transaction.is_refund && (
                <Button
                  onClick={() => setShowRefundDialog(true)}
                  variant="destructive"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Process Refund
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentApprovalDialog
        transaction={transaction}
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        onSuccess={() => {
          onTransactionUpdated();
          onOpenChange(false);
        }}
      />

      <RefundDialog
        transaction={transaction}
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        onSuccess={() => {
          onTransactionUpdated();
          onOpenChange(false);
        }}
      />
    </>
  );
}