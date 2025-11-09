import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
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

interface AutoExpenseDialogProps {
  clubId: string;
  currency?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoExpenseDialog({ clubId, currency = 'USD', open, onOpenChange }: AutoExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'utilities',
    day_of_month: '1',
    description: '',
  });

  // Fetch recurring expenses
  const { data: recurringExpenses, isLoading } = useQuery({
    queryKey: ['recurring_expenses', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsAdding(true);
    try {
      const expenseData = {
        club_id: clubId,
        name: formData.name,
        amount: parseFloat(formData.amount),
        category: formData.category,
        day_of_month: parseInt(formData.day_of_month),
        description: formData.description || null,
        is_active: true,
      };

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('recurring_expenses')
          .update(expenseData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Auto expense updated successfully");
      } else {
        // Create new
        const { error } = await supabase
          .from('recurring_expenses')
          .insert(expenseData);

        if (error) throw error;
        toast.success("Auto expense created successfully");
      }

      // Reset form
      setFormData({
        name: '',
        amount: '',
        category: 'utilities',
        day_of_month: '1',
        description: '',
      });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    } catch (error: any) {
      console.error('Error saving auto expense:', error);
      toast.error(error.message || 'Failed to save auto expense');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      category: expense.category,
      day_of_month: expense.day_of_month.toString(),
      description: expense.description || '',
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: false })
        .eq('id', deleteId);

      if (error) throw error;

      toast.success("Auto expense deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
      setShowDeleteDialog(false);
      setDeleteId(null);
    } catch (error: any) {
      console.error('Error deleting auto expense:', error);
      toast.error(error.message || 'Failed to delete auto expense');
    }
  };

  const handleProcessNow = async (expenseId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const { error } = await supabase.functions.invoke('process-recurring-expense', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          expense_id: expenseId,
        },
      });

      if (error) throw error;

      toast.success("Expense processed and added to ledger");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error: any) {
      console.error('Error processing expense:', error);
      toast.error(error.message || 'Failed to process expense');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto Recurring Expenses</DialogTitle>
            <DialogDescription>
              Set up monthly recurring expenses that will be automatically added to your transaction ledger
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add/Edit Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingId ? 'Edit' : 'Add'} Auto Expense
                </CardTitle>
                <CardDescription>
                  These expenses will be automatically added at the end of each month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Expense Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Rent, Electricity, Internet"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ({currency}) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="10.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="salaries">Salaries</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="day_of_month">Day of Month</Label>
                    <Select
                      value={formData.day_of_month}
                      onValueChange={(value) => setFormData({ ...formData, day_of_month: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st (End of Month)</SelectItem>
                        <SelectItem value="5">5th</SelectItem>
                        <SelectItem value="10">10th</SelectItem>
                        <SelectItem value="15">15th</SelectItem>
                        <SelectItem value="20">20th</SelectItem>
                        <SelectItem value="25">25th</SelectItem>
                        <SelectItem value="30">30th (Last day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="Additional notes..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isAdding} className="flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      {editingId ? 'Update' : 'Add'} Auto Expense
                    </Button>
                    {editingId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setFormData({
                            name: '',
                            amount: '',
                            category: 'utilities',
                            day_of_month: '1',
                            description: '',
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* List of Recurring Expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Auto Expenses</CardTitle>
                <CardDescription>
                  Manage your recurring monthly expenses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-20 bg-muted animate-pulse rounded" />
                    <div className="h-20 bg-muted animate-pulse rounded" />
                  </div>
                ) : recurringExpenses && recurringExpenses.length > 0 ? (
                  <div className="space-y-2">
                    {recurringExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{expense.name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {expense.category}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600">
                              {formatCurrency(expense.amount, { currency })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          Processes on day {expense.day_of_month} of each month
                        </div>

                        {expense.description && (
                          <div className="text-sm text-muted-foreground">
                            {expense.description}
                          </div>
                        )}

                        <div className="flex gap-1 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(expense)}
                            className="flex-1"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessNow(expense.id)}
                            className="flex-1"
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            Process Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeleteId(expense.id);
                              setShowDeleteDialog(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No auto expenses configured yet</p>
                    <p className="text-sm">Add your first recurring expense to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auto Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recurring expense? This will not affect existing transactions in the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
