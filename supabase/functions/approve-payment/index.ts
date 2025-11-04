import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Get auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { transaction_id, payment_proof_url, notes } = await req.json();

    if (!transaction_id) {
      throw new Error('Transaction ID is required');
    }

    // Get the transaction
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transaction_ledger')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (fetchError || !transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.payment_status === 'paid') {
      throw new Error('Transaction is already paid');
    }

    // Store previous values for history
    const previousValues = {
      payment_status: transaction.payment_status,
      payment_proof_url: transaction.payment_proof_url
    };

    // Update transaction to paid
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from('transaction_ledger')
      .update({
        payment_status: 'paid',
        payment_proof_url: payment_proof_url || transaction.payment_proof_url,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log to transaction history
    await supabaseAdmin
      .from('transaction_history')
      .insert({
        transaction_id,
        changed_by: user.id,
        change_type: 'approved',
        previous_values: previousValues,
        new_values: {
          payment_status: 'paid',
          payment_proof_url: payment_proof_url || transaction.payment_proof_url,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        },
        notes: notes || 'Payment approved by admin'
      });

    // Send receipt email if member email exists
    if (updatedTransaction.member_email) {
      try {
        await supabaseAdmin.functions.invoke('send-registration-receipt', {
          body: {
            clubId: updatedTransaction.club_id,
            parentEmail: updatedTransaction.member_email,
            parentName: updatedTransaction.member_name || 'Member',
            receiptNumber: updatedTransaction.receipt_number,
            transactionId: updatedTransaction.id,
            items: [{
              description: updatedTransaction.description,
              amount: parseFloat(updatedTransaction.amount)
            }],
            subtotal: parseFloat(updatedTransaction.amount),
            vat: parseFloat(updatedTransaction.vat_amount || 0),
            total: parseFloat(updatedTransaction.total_amount),
            paymentMethod: updatedTransaction.payment_method,
            transactionDate: updatedTransaction.transaction_date
          }
        });
      } catch (emailError) {
        console.error('Failed to send receipt email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, transaction: updatedTransaction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in approve-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});