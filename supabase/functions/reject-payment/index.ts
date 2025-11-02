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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { transaction_id, rejection_reason } = await req.json();

    if (!transaction_id || !rejection_reason) {
      throw new Error('Transaction ID and rejection reason are required');
    }

    // Get the transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('transaction_ledger')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (fetchError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Store previous values for history
    const previousValues = {
      payment_status: transaction.payment_status,
      rejection_reason: transaction.rejection_reason
    };

    // Update transaction to rejected
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transaction_ledger')
      .update({
        payment_status: 'rejected',
        rejection_reason,
        updated_by: user.id
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log to transaction history
    await supabase
      .from('transaction_history')
      .insert({
        transaction_id,
        changed_by: user.id,
        change_type: 'rejected',
        previous_values: previousValues,
        new_values: {
          payment_status: 'rejected',
          rejection_reason
        },
        notes: `Payment rejected: ${rejection_reason}`
      });

    return new Response(
      JSON.stringify({ success: true, transaction: updatedTransaction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in reject-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});