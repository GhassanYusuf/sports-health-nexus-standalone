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

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      throw new Error('Transaction ID is required');
    }

    console.log(`[soft-delete-transaction] Soft deleting transaction ${transaction_id} by user ${user.id}`);

    // Get the existing transaction to verify it exists and is not already deleted
    const { data: existingTransaction, error: fetchError } = await supabaseAdmin
      .from('transaction_ledger')
      .select('id, deleted_at, receipt_number')
      .eq('id', transaction_id)
      .single();

    if (fetchError) {
      console.error('[soft-delete-transaction] Error fetching transaction:', fetchError);
      throw fetchError;
    }

    if (!existingTransaction) {
      throw new Error('Transaction not found');
    }

    if (existingTransaction.deleted_at) {
      throw new Error('Transaction is already deleted');
    }

    // Soft delete the transaction by setting deleted_at timestamp
    const { data: deletedTransaction, error: deleteError } = await supabaseAdmin
      .from('transaction_ledger')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (deleteError) {
      console.error('[soft-delete-transaction] Error soft deleting transaction:', deleteError);
      throw deleteError;
    }

    console.log(`[soft-delete-transaction] Successfully soft deleted transaction ${existingTransaction.receipt_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transaction deleted successfully',
        data: deletedTransaction
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[soft-delete-transaction] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
