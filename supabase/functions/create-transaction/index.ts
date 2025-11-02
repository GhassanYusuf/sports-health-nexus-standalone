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
  } catch (error) {
    console.error('[create-transaction] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
