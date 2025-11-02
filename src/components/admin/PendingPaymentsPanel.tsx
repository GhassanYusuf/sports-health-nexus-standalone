import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Eye, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { TransactionDetailDialog } from "./TransactionDetailDialog";
import { toast } from "sonner";

interface PendingPaymentsPanelProps {
  clubId: string;
  currency: string;
}

export function PendingPaymentsPanel({ clubId, currency }: PendingPaymentsPanelProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: pendingPayments, isLoading, refetch } = useQuery({
    queryKey: ['pending-payments', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_ledger')
        .select('*')
        .eq('club_id', clubId)
        .eq('payment_status', 'pending')
        .order('transaction_date', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const handleViewTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailDialog(true);
  };

  const handleCallMember = (phone: string) => {
    if (phone) {
      window.open(`tel:${phone}`, '_blank');
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmailMember = (email: string) => {
    if (email) {
      window.open(`mailto:${email}?subject=Payment Reminder&body=Dear member, this is a reminder about your pending payment.`, '_blank');
    } else {
      toast.error('No email address available');
    }
  };

  const getDaysOverdue = (transactionDate: string) => {
    return differenceInDays(new Date(), new Date(transactionDate));
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading pending payments...</div>;
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Pending Payments</h3>
        <p className="text-muted-foreground">
          All payments are up to date!
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Pending Payments</h3>
            <p className="text-sm text-muted-foreground">
              {pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {pendingPayments.map((payment) => {
            const daysOverdue = getDaysOverdue(payment.transaction_date);
            const isOverdue = daysOverdue > 7; // Consider overdue after 7 days

            return (
              <Card key={payment.id} className={`p-4 ${isOverdue ? 'border-orange-500' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">
                        {payment.member_name || 'Unknown Member'}
                      </h4>
                      {isOverdue && (
                        <Badge variant="destructive" className="bg-orange-500">
                          {daysOverdue} days overdue
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Receipt #</p>
                        <p className="font-medium">{payment.receipt_number}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium text-lg">
                          {currency}{parseFloat(String(payment.total_amount)).toFixed(2)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Description</p>
                        <p className="font-medium">{payment.description}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Transaction Date</p>
                        <p className="font-medium">
                          {format(new Date(payment.transaction_date), 'PP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Method</p>
                        <p className="font-medium capitalize">{payment.payment_method}</p>
                      </div>
                    </div>

                    {(payment.member_email || payment.member_phone) && (
                      <div className="flex gap-2 mt-3">
                        {payment.member_phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCallMember(payment.member_phone)}
                            className="gap-2"
                          >
                            <Phone className="h-3 w-3" />
                            Call
                          </Button>
                        )}
                        {payment.member_email && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEmailMember(payment.member_email)}
                            className="gap-2"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handleViewTransaction(payment)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Review
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <TransactionDetailDialog
        transaction={selectedTransaction}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        onTransactionUpdated={refetch}
        currency={currency}
      />
    </>
  );
}