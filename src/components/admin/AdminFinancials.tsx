import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Plus, TrendingUp, TrendingDown, DollarSign, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionEntryDialog } from "./TransactionEntryDialog";
import { ManualIncomeDialog } from "./ManualIncomeDialog";
import { TransactionDetailDialog } from "./TransactionDetailDialog";
import { TransactionsByMonthDialog } from "./TransactionsByMonthDialog";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currencyUtils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AdminFinancialsProps {
  clubId: string;
  currency?: string;
}

export function AdminFinancials({ clubId, currency = 'USD' }: AdminFinancialsProps) {
  const queryClient = useQueryClient();
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showManualIncomeDialog, setShowManualIncomeDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [showMonthTransactions, setShowMonthTransactions] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ month: string; year: number } | null>(null);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTransaction, setDeleteTransaction] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Fetch transactions (exclude soft-deleted)
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', clubId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_ledger')
        .select('*')
        .eq('club_id', clubId)
        .gte('transaction_date', dateRange.start)
        .lte('transaction_date', dateRange.end)
        .is('deleted_at', null)  // Filter out soft-deleted transactions
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Calculate summary statistics
  const summary = transactions?.reduce((acc, t) => {
    const amount = parseFloat(String(t.total_amount || 0));
    if (['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(t.transaction_type)) {
      acc.income += amount;
    } else if (t.transaction_type === 'expense') {
      acc.expenses += amount;
    } else if (t.transaction_type === 'refund') {
      acc.refunds += amount;
    }
    return acc;
  }, { income: 0, expenses: 0, refunds: 0 }) || { income: 0, expenses: 0, refunds: 0 };

  const netIncome = summary.income - summary.expenses - summary.refunds;

  // Prepare monthly chart data from transactions
  const monthlyData = useMemo(() => {
    if (!transactions) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    // Initialize last 12 months
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyTotals[key] = { income: 0, expenses: 0 };
    }

    // Aggregate transaction data by month
    transactions.forEach(entry => {
      const date = new Date(entry.transaction_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (monthlyTotals[key]) {
        const amount = parseFloat(String(entry.total_amount || 0));
        if (['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(entry.transaction_type)) {
          monthlyTotals[key].income += amount;
        } else if (entry.transaction_type === 'expense') {
          monthlyTotals[key].expenses += amount;
        } else if (entry.transaction_type === 'refund') {
          monthlyTotals[key].expenses += amount; // Treat refunds as expenses
        }
      }
    });

    // Convert to chart format
    return Object.keys(monthlyTotals)
      .sort()
      .map(key => {
        const [year, monthIndex] = key.split('-').map(Number);
        return {
          month: monthNames[monthIndex],
          income: monthlyTotals[key].income,
          expenses: monthlyTotals[key].expenses,
          profit: monthlyTotals[key].income - monthlyTotals[key].expenses
        };
      });
  }, [transactions]);

  // Handle soft delete
  const handleDelete = async () => {
    if (!deleteTransaction) return;

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const { error } = await supabase.functions.invoke('soft-delete-transaction', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          transaction_id: deleteTransaction.id,
        },
      });

      if (error) throw error;

      toast.success(`Transaction ${deleteTransaction.receipt_number} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowDeleteDialog(false);
      setDeleteTransaction(null);
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = ['Date', 'Type', 'Description', 'Amount', 'VAT', 'Total', 'Receipt #'];
    const rows = transactions.map(t => [
      format(new Date(t.transaction_date), 'yyyy-MM-dd'),
      t.transaction_type,
      t.description,
      t.amount,
      t.vat_amount,
      t.total_amount,
      t.receipt_number || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    toast.success("Transactions exported successfully");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Financial Management</h2>
          <p className="text-muted-foreground">Track income, expenses, and generate reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowManualIncomeDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Manual Income
          </Button>
          <Button onClick={() => setShowTransactionDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {formatCurrency(summary.income, { currency })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              {formatCurrency(summary.expenses, { currency })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.refunds, { currency })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-2 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <DollarSign className="w-5 h-5" />
              {formatCurrency(netIncome, { currency })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Income/Expense Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Overview (Last 12 Months)</CardTitle>
            <CardDescription>Monthly income, expenses, and profit trends. Click on any point to view transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={monthlyData}
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    const currentYear = new Date().getFullYear();
                    setSelectedMonth({ month: data.activeLabel, year: currentYear });
                    setShowMonthTransactions(true);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value, { currency, showSymbol: false })} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value, { currency })}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete record of all financial transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Receipt #</th>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2 text-right">VAT</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => {
                        // Allow editing for all transaction types
                        const canEdit = ['expense', 'refund', 'product_sale', 'facility_rental', 'enrollment_fee', 'package_fee'].includes(t.transaction_type);
                        return (
                          <tr
                            key={t.id}
                            className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedTransaction(t);
                              setShowTransactionDetail(true);
                            }}
                          >
                            <td className="p-2">{format(new Date(t.transaction_date), 'MMM dd, yyyy')}</td>
                            <td className="p-2 font-mono text-sm">{t.receipt_number}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                ['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(t.transaction_type)
                                  ? 'bg-green-100 text-green-700'
                                  : t.transaction_type === 'expense'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {t.transaction_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-2">{t.description}</td>
                            <td className="p-2 text-right">{formatCurrency(parseFloat(String(t.amount)), { currency })}</td>
                            <td className="p-2 text-right">{formatCurrency(parseFloat(String(t.vat_amount)), { currency })}</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(parseFloat(String(t.total_amount)), { currency })}</td>
                            <td className="p-2">
                              <div className="flex gap-1 justify-center">
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditTransaction(t);
                                      setShowEditDialog(true);
                                    }}
                                    className="h-8 w-8 p-0"
                                    title="Edit transaction"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTransaction(t);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Delete transaction"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions found for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Categorized expenses for accounting</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions?.filter(t => t.transaction_type === 'expense').length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(
                    transactions
                      .filter(t => t.transaction_type === 'expense')
                      .reduce((acc, t) => {
                        const cat = t.category || 'other';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(t);
                        return acc;
                      }, {} as Record<string, any[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h3 className="font-semibold capitalize mb-2">{category}</h3>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.description}</span>
                            <span className="font-medium">{formatCurrency(parseFloat(item.total_amount), { currency })}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(items.reduce((sum, i) => sum + parseFloat(i.total_amount), 0), { currency })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No expenses recorded for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>Generate reports for tax compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Monthly Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Period:</span>
                      <p className="font-medium">{format(new Date(dateRange.start), 'MMM dd, yyyy')} - {format(new Date(dateRange.end), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transactions:</span>
                      <p className="font-medium">{transactions?.length || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Income vs Expenses</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Gross Income</span>
                      <span className="font-medium text-green-600">{formatCurrency(summary.income, { currency })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Expenses</span>
                      <span className="font-medium text-red-600">-{formatCurrency(summary.expenses, { currency })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Refunds</span>
                      <span className="font-medium text-orange-600">-{formatCurrency(summary.refunds, { currency })}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between font-bold text-lg">
                      <span>Net Profit</span>
                      <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(netIncome, { currency })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TransactionEntryDialog
        clubId={clubId}
        currency={currency}
        open={showTransactionDialog}
        onOpenChange={setShowTransactionDialog}
      />

      <TransactionEntryDialog
        clubId={clubId}
        currency={currency}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        transaction={editTransaction}
        onSuccess={() => {
          setShowEditDialog(false);
          setEditTransaction(null);
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }}
      />

      <ManualIncomeDialog
        clubId={clubId}
        currency={currency}
        open={showManualIncomeDialog}
        onOpenChange={setShowManualIncomeDialog}
        onSuccess={() => {
          setShowManualIncomeDialog(false);
          // Refetch will happen automatically via react-query
        }}
      />

      {selectedTransaction && (
        <TransactionDetailDialog
          transaction={selectedTransaction}
          open={showTransactionDetail}
          onOpenChange={setShowTransactionDetail}
          onTransactionUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
          }}
          currency={currency}
        />
      )}

      {selectedMonth && (
        <TransactionsByMonthDialog
          open={showMonthTransactions}
          onOpenChange={setShowMonthTransactions}
          clubId={clubId}
          month={selectedMonth.month}
          year={selectedMonth.year}
          currency={currency}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete transaction <strong>{deleteTransaction?.receipt_number}</strong>?
              <br />
              <br />
              This will soft delete the transaction. It won't be visible in the ledger but can be restored if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
