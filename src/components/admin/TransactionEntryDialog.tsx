import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const transactionSchema = z.object({
  transaction_type: z.enum(['expense', 'refund', 'product_sale', 'facility_rental', 'enrollment_fee', 'package_fee']),
  category: z.enum(['rent', 'utilities', 'equipment', 'salaries', 'maintenance', 'marketing', 'insurance', 'other']).nullable().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.string().nullable().optional(),
  transaction_date: z.string().min(1, "Date is required"),
  notes: z.string().nullable().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionEntryDialogProps {
  clubId: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: any; // Optional: if provided, dialog is in edit mode
  onSuccess?: () => void; // Optional: callback after successful update
}

export function TransactionEntryDialog({ clubId, currency, open, onOpenChange, transaction, onSuccess }: TransactionEntryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const isEditMode = !!transaction;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: isEditMode ? {
      transaction_type: transaction.transaction_type,
      category: transaction.category,
      description: transaction.description,
      amount: String(transaction.amount),
      payment_method: transaction.payment_method || 'cash',
      transaction_date: transaction.transaction_date,
      notes: transaction.notes || '',
    } : {
      transaction_type: 'expense',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
    },
  });

  const transactionType = form.watch('transaction_type');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open && !isEditMode) {
      // Clear form when dialog closes (only for new transactions, not edits)
      form.reset({
        transaction_type: 'expense',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
      });
    }
  }, [open, isEditMode, form]);

  // Reset form when transaction changes
  useEffect(() => {
    if (isEditMode && transaction) {
      form.reset({
        transaction_type: transaction.transaction_type,
        category: transaction.category,
        description: transaction.description,
        amount: String(transaction.amount),
        payment_method: transaction.payment_method || 'cash',
        transaction_date: transaction.transaction_date,
        notes: transaction.notes || '',
      });
    } else if (!isEditMode) {
      form.reset({
        transaction_type: 'expense',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
      });
    }
  }, [transaction, isEditMode, form]);

  const onSubmit = async (values: TransactionFormValues) => {
    console.log('🔥 SUBMIT FUNCTION CALLED!', { isEditMode, values });
    setIsSubmitting(true);
    try {
      console.log('Starting transaction submission...', { isEditMode, values });

      // Get club's current VAT rate
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('vat_percentage')
        .eq('id', clubId)
        .single();

      if (clubError) {
        console.error('Error fetching club:', clubError);
        throw clubError;
      }

      if (isEditMode) {
        console.log('Updating transaction:', transaction.id);

        // Get current session for auth token
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('No active session');
        }

        // Update existing transaction
        const { data, error } = await supabase.functions.invoke('update-transaction', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            transaction_id: transaction.id,
            transaction_type: values.transaction_type,
            category: values.category,
            description: values.description,
            amount: parseFloat(values.amount),
            vat_percentage_applied: club.vat_percentage || 0,
            payment_method: values.payment_method,
            payment_status: transaction.payment_status || 'paid',
            transaction_date: values.transaction_date,
            notes: values.notes,
          },
        });

        console.log('Update response:', { data, error });

        if (error) {
          console.error('Update error:', error);
          // Extract the actual error message from the Edge Function response
          // For 400 errors, data should have the error message
          // For 500 errors, we need to parse from error.context
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
            errorMessage = error.message || 'Failed to update transaction';
          }

          throw new Error(errorMessage);
        }

        toast.success('Transaction updated successfully');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        onSuccess?.();
        onOpenChange(false);
      } else {
        console.log('Creating new transaction');

        // Create new transaction (always paid when manually recording)
        const { data, error } = await supabase.functions.invoke('create-transaction', {
          body: {
            club_id: clubId,
            transaction_type: values.transaction_type,
            category: values.category,
            description: values.description,
            amount: parseFloat(values.amount),
            vat_percentage_applied: club.vat_percentage || 0,
            payment_method: values.payment_method,
            payment_status: 'paid', // Always paid when recording expense
            transaction_date: values.transaction_date,
            notes: values.notes,
          },
        });

        console.log('Create response:', { data, error });

        if (error) {
          console.error('Create error:', error);
          // Extract the actual error message from the Edge Function response
          // For 400 errors, data should have the error message
          // For 500 errors, we need to parse from error.context
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
            errorMessage = error.message || 'Failed to create transaction';
          }

          throw new Error(errorMessage);
        }

        toast.success('Transaction recorded successfully');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        form.reset();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} transaction:`, error);
      // Show the specific error message (e.g., "Insufficient funds")
      const errorMessage = error.message || `Failed to ${isEditMode ? 'update' : 'record'} transaction`;
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Transaction' : 'Record Transaction'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the transaction details below. Changes will be tracked in the history.'
              : 'Add a new expense, refund, or income transaction to the ledger'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              console.log('📝 Form onSubmit event triggered');
              console.log('Form state:', {
                isValid: form.formState.isValid,
                errors: form.formState.errors,
                values: form.getValues()
              });
              form.handleSubmit(
                (data) => {
                  console.log('✅ Validation passed, calling onSubmit');
                  onSubmit(data);
                },
                (errors) => {
                  console.error('❌ Validation failed:', errors);
                }
              )(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="transaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="product_sale">Product Sale</SelectItem>
                      <SelectItem value="facility_rental">Facility Rental</SelectItem>
                      <SelectItem value="enrollment_fee">Enrollment Fee</SelectItem>
                      <SelectItem value="package_fee">Package Fee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {transactionType === 'expense' && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="salaries">Salaries</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the category for proper expense tracking
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly gym rent" {...field} />
                  </FormControl>
                  <FormDescription>
                    Brief description of the transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Amount before VAT
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={() => {
                  console.log('🟢 Button clicked!', {
                    isEditMode,
                    isSubmitting,
                    formErrors: form.formState.errors,
                    formValues: form.getValues()
                  });
                }}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditMode ? 'Update Transaction' : 'Record Transaction'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
