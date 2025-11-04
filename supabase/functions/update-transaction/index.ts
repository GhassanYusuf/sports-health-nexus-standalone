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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      transaction_id,
      transaction_type,
      category,
      description,
      amount,
      vat_percentage_applied,
      payment_method,
      transaction_date,
      notes,
    } = await req.json();

    if (!transaction_id) {
      throw new Error('Transaction ID is required');
    }

    console.log(`[update-transaction] Updating transaction ${transaction_id} by user ${user.id}`);

    // Get the existing transaction to preserve history
    const { data: existingTransaction, error: fetchError } = await supabaseAdmin
      .from('transaction_ledger')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (fetchError) {
      console.error('[update-transaction] Error fetching transaction:', fetchError);
      throw fetchError;
    }

    if (!existingTransaction) {
      throw new Error('Transaction not found');
    }

    // Create change history entry
    const currentVersion = existingTransaction.version || 0;
    const changeHistory = existingTransaction.change_history || [];

    // Add previous state to history
    const historyEntry = {
      version: currentVersion,
      changed_at: new Date().toISOString(),
      changed_by: user.id,
      previous_values: {
        transaction_type: existingTransaction.transaction_type,
        category: existingTransaction.category,
        description: existingTransaction.description,
        amount: existingTransaction.amount,
        vat_percentage_applied: existingTransaction.vat_percentage_applied,
        payment_method: existingTransaction.payment_method,
        transaction_date: existingTransaction.transaction_date,
        notes: existingTransaction.notes,
      }
    };

    changeHistory.push(historyEntry);

    // Calculate new VAT and total
    const vatAmount = parseFloat(amount) * (parseFloat(vat_percentage_applied) / 100);
    const totalAmount = parseFloat(amount) + vatAmount;

    // Update transaction
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from('transaction_ledger')
      .update({
        transaction_type,
        category,
        description,
        amount: parseFloat(amount),
        vat_amount: vatAmount,
        vat_percentage_applied: parseFloat(vat_percentage_applied),
        total_amount: totalAmount,
        payment_method,
        transaction_date,
        notes,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        version: currentVersion + 1,
        change_history: changeHistory,
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (updateError) {
      console.error('[update-transaction] Error updating transaction:', updateError);
      throw updateError;
    }

    console.log(`[update-transaction] Updated transaction ${transaction_id} to version ${currentVersion + 1}`);

    return new Response(
      JSON.stringify(updatedTransaction),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[update-transaction] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
