import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { expense_id } = await req.json()

    if (!expense_id) {
      throw new Error('expense_id is required')
    }

    // Get the recurring expense
    const { data: expense, error: expenseError } = await supabaseClient
      .from('recurring_expenses')
      .select('*')
      .eq('id', expense_id)
      .eq('is_active', true)
      .single()

    if (expenseError) throw expenseError
    if (!expense) throw new Error('Recurring expense not found')

    // Check cash balance before processing expense
    console.log('[process-recurring-expense] Checking cash balance before processing');

    // Fetch all transactions to calculate current cash balance
    const { data: allTransactions, error: transactionsError } = await supabaseClient
      .from('transaction_ledger')
      .select('transaction_type, total_amount, payment_status')
      .eq('club_id', expense.club_id)
      .is('deleted_at', null);

    if (transactionsError) {
      console.error('[process-recurring-expense] Error fetching transactions:', transactionsError);
      throw transactionsError;
    }

    // Calculate current cash balance (same logic as AdminFinancials.tsx)
    let currentCash = 0;
    allTransactions?.forEach((t: any) => {
      const txAmount = parseFloat(String(t.total_amount || 0));
      if (['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(t.transaction_type)) {
        if (t.payment_status === 'paid') {
          currentCash += txAmount;
        }
      } else if (t.transaction_type === 'expense') {
        if (t.payment_status === 'paid') {
          currentCash -= txAmount;
        }
      } else if (t.transaction_type === 'refund') {
        if (t.payment_status === 'paid') {
          currentCash -= txAmount;
        }
      }
    });

    const expenseAmount = parseFloat(String(expense.amount));
    console.log(`[process-recurring-expense] Current cash: ${currentCash}, Required: ${expenseAmount}`);

    // Check if there's enough cash
    if (currentCash < expenseAmount) {
      throw new Error(`Insufficient funds. Available cash: ${currentCash.toFixed(2)}, Required: ${expenseAmount.toFixed(2)}`);
    }

    // Generate sequential receipt number
    // Get the last auto expense receipt number
    const { data: lastTransaction } = await supabaseClient
      .from('transaction_ledger')
      .select('receipt_number')
      .eq('club_id', expense.club_id)
      .like('receipt_number', 'EXP-AUTO-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (lastTransaction?.receipt_number) {
      // Extract number from EXP-AUTO-0001 (only match exactly 4 digits)
      const match = lastTransaction.receipt_number.match(/EXP-AUTO-(\d{4})$/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const receiptNumber = `EXP-AUTO-${nextNumber.toString().padStart(4, '0')}`

    // Create transaction in ledger
    const transactionData = {
      club_id: expense.club_id,
      transaction_type: 'expense',
      transaction_date: new Date().toISOString(),
      amount: expense.amount,
      vat_amount: 0,
      total_amount: expense.amount,
      description: `Auto: ${expense.name}${expense.description ? ` - ${expense.description}` : ''}`,
      category: expense.category,
      payment_status: 'paid',
      payment_method: 'auto',
      receipt_number: receiptNumber,
    }

    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transaction_ledger')
      .insert(transactionData)
      .select()
      .single()

    if (transactionError) throw transactionError

    // Update last_processed_at timestamp
    const { error: updateError } = await supabaseClient
      .from('recurring_expenses')
      .update({ last_processed_at: new Date().toISOString() })
      .eq('id', expense_id)

    if (updateError) {
      console.error('Error updating last_processed_at:', updateError)
      // Don't throw - transaction was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        message: `Recurring expense "${expense.name}" processed successfully`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error processing recurring expense:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
