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

    const { 
      original_transaction_id, 
      refund_amount,
      refund_reason,
      refund_proof_url,
      is_full_refund = true
    } = await req.json();

    if (!original_transaction_id) {
      throw new Error('Original transaction ID is required');
    }

    // Get the original transaction
    const { data: originalTransaction, error: fetchError } = await supabaseAdmin
      .from('transaction_ledger')
      .select('*')
      .eq('id', original_transaction_id)
      .single();

    if (fetchError || !originalTransaction) {
      throw new Error('Original transaction not found');
    }

    const originalAmount = parseFloat(originalTransaction.total_amount);
    const refundAmountValue = is_full_refund ? originalAmount : parseFloat(refund_amount);

    if (refundAmountValue > originalAmount) {
      throw new Error('Refund amount cannot exceed original transaction amount');
    }

    // Generate receipt number for refund
    const { data: receiptNumber, error: receiptError } = await supabaseAdmin
      .rpc('generate_receipt_number', { p_club_id: originalTransaction.club_id });

    if (receiptError) {
      throw new Error('Failed to generate receipt number');
    }

    // Create refund transaction
    const { data: refundTransaction, error: insertError } = await supabaseAdmin
      .from('transaction_ledger')
      .insert({
        club_id: originalTransaction.club_id,
        transaction_type: 'refund',
        category: null,
        description: `Refund for: ${originalTransaction.description}`,
        amount: refundAmountValue,
        vat_amount: parseFloat(originalTransaction.vat_amount || 0) * (refundAmountValue / originalAmount),
        total_amount: refundAmountValue,
        vat_percentage_applied: originalTransaction.vat_percentage_applied,
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'refund',
        notes: refund_reason,
        receipt_number: receiptNumber,
        payment_status: 'paid',
        is_refund: true,
        refund_amount: refundAmountValue,
        refunded_transaction_id: original_transaction_id,
        refund_proof_url,
        member_name: originalTransaction.member_name,
        member_email: originalTransaction.member_email,
        member_phone: originalTransaction.member_phone,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log to transaction history
    await supabaseAdmin
      .from('transaction_history')
      .insert({
        transaction_id: refundTransaction.id,
        changed_by: user.id,
        change_type: 'refunded',
        new_values: {
          refund_amount: refundAmountValue,
          refunded_transaction_id: original_transaction_id,
          is_full_refund
        },
        notes: refund_reason
      });

    return new Response(
      JSON.stringify({ success: true, refund: refundTransaction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-refund:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});