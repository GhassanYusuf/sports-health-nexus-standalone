import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currencyUtils";
import { format } from "date-fns";
import { TransactionDetailDialog } from "./TransactionDetailDialog";

interface TransactionsByMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  month: string;
  year: number;
  currency?: string;
}

export function TransactionsByMonthDialog({
  open,
  onOpenChange,
  clubId,
  month,
  year,
  currency = 'USD'
}: TransactionsByMonthDialogProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = monthNames.indexOf(month);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['month-transactions', clubId, month, year],
    queryFn: async () => {
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0);

      const { data, error } = await supabase
        .from('transaction_ledger')
        .select('*')
        .eq('club_id', clubId)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clubId && monthIndex >= 0
  });

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailDialog(true);
  };

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      enrollment_fee: 'default',
      package_fee: 'default',
      product_sale: 'default',
      facility_rental: 'default',
      manual_income: 'default',
      expense: 'destructive',
      refund: 'secondary'
    };
    return <Badge variant={variants[type] || 'outline'}>{type.replace('_', ' ')}</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Transactions for {month} {year}</DialogTitle>
            <DialogDescription>
              Click on any transaction to view details
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn: any) => (
                  <div
                    key={txn.id}
                    onClick={() => handleTransactionClick(txn)}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {getTransactionTypeBadge(txn.transaction_type)}
                          {txn.receipt_number && (
                            <span className="text-sm text-muted-foreground">
                              {txn.receipt_number}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{txn.description || 'No description'}</p>
                        {txn.member_name && (
                          <p className="text-sm text-muted-foreground">{txn.member_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(txn.transaction_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          txn.transaction_type === 'expense' || txn.transaction_type === 'refund' 
                            ? 'text-destructive' 
                            : 'text-green-600'
                        }`}>
                          {txn.transaction_type === 'expense' || txn.transaction_type === 'refund' ? '-' : '+'}
                          {formatCurrency(parseFloat(String(txn.total_amount)), { currency })}
                        </p>
                        {txn.payment_status && (
                          <Badge variant={
                            txn.payment_status === 'paid' ? 'default' :
                            txn.payment_status === 'pending' ? 'secondary' :
                            'destructive'
                          } className="mt-1">
                            {txn.payment_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found for this month
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedTransaction && (
        <TransactionDetailDialog
          transaction={selectedTransaction}
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          onTransactionUpdated={() => {
            // Refresh will happen automatically via react-query
          }}
          currency={currency}
        />
      )}
    </>
  );
}
