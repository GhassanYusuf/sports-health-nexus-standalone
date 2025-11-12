import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      club_id,
      transaction_type,
      category,
      description,
      amount,
      vat_percentage_applied,
      payment_method,
      payment_screenshot_url,
      member_id,
      package_price_version_id,
      enrollment_id,
      reference_id,
      transaction_date,
      notes,
      payment_status = 'paid',
      payment_proof_url,
      member_name,
      member_email,
      member_phone
    } = await req.json();

    console.log(`[create-transaction] Creating ${transaction_type} transaction for club ${club_id}, amount: ${amount}`);

    // Calculate VAT and total
    const vatAmount = parseFloat(amount) * (parseFloat(vat_percentage_applied) / 100);
    const totalAmount = parseFloat(amount) + vatAmount;

    // Check cash balance for expenses that are marked as paid
    if (transaction_type === 'expense' && payment_status === 'paid') {
      console.log(`[create-transaction] Checking cash balance for expense payment`);

      // Fetch all transactions to calculate current cash balance
      const { data: allTransactions, error: transactionsError } = await supabaseAdmin
        .from('transaction_ledger')
        .select('transaction_type, total_amount, payment_status')
        .eq('club_id', club_id)
        .is('deleted_at', null);

      if (transactionsError) {
        console.error('[create-transaction] Error fetching transactions:', transactionsError);
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

      console.log(`[create-transaction] Current cash: ${currentCash}, Required: ${totalAmount}`);

      // Check if there's enough cash
      if (currentCash < totalAmount) {
        throw new Error(`Insufficient funds. Available cash: ${currentCash.toFixed(2)}, Required: ${totalAmount.toFixed(2)}`);
      }
    }

    // Generate receipt number
    const { data: receiptNumber, error: receiptError } = await supabaseAdmin
      .rpc('generate_receipt_number', { p_club_id: club_id });

    if (receiptError) {
      console.error('[create-transaction] Error generating receipt number:', receiptError);
      throw receiptError;
    }

    console.log(`[create-transaction] Generated receipt number: ${receiptNumber}`);

    // Create transaction
    const { data: transaction, error } = await supabaseAdmin
      .from('transaction_ledger')
      .insert({
        club_id,
        transaction_type,
        category,
        description,
        amount: parseFloat(amount),
        vat_amount: vatAmount,
        vat_percentage_applied: parseFloat(vat_percentage_applied),
        total_amount: totalAmount,
        payment_method,
        payment_screenshot_url,
        receipt_number: receiptNumber,
        member_id,
        package_price_version_id,
        enrollment_id,
        reference_id,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0],
        notes,
        payment_status,
        payment_proof_url: payment_proof_url || payment_screenshot_url,
        member_name,
        member_email,
        member_phone
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[create-transaction] Created transaction ${transaction.receipt_number}: ${transaction_type} ${totalAmount}`);

    return new Response(
      JSON.stringify(transaction),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-transaction] Error:', error);

    // Use 400 for validation errors (like insufficient funds), 500 for actual server errors
    const isValidationError = error.message?.includes('Insufficient funds') ||
                              error.message?.includes('out of range');
    const statusCode = isValidationError ? 400 : 500;

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
