import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron job to check for expiring/expired package enrollments
 * and send invoices (for unpaid) or receipts (for paid) to members
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[check-expiring-packages] Starting cron job...");

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Find all active enrollments expiring today
    const { data: expiringEnrollments, error: enrollError } = await supabase
      .from("package_enrollments")
      .select(`
        id,
        member_id,
        package_id,
        start_date,
        end_date,
        enrolled_at,
        enrollment_transaction_id,
        package_transaction_id
      `)
      .eq("is_active", true)
      .eq("end_date", today);

    if (enrollError) {
      console.error("[check-expiring-packages] Error fetching enrollments:", enrollError);
      throw enrollError;
    }

    console.log(`[check-expiring-packages] Found ${expiringEnrollments?.length || 0} expiring enrollments`);

    if (!expiringEnrollments || expiringEnrollments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expiring packages found",
          count: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const enrollment of expiringEnrollments) {
      try {
        console.log(`[check-expiring-packages] Processing enrollment: ${enrollment.id}`);

        // Get the related transaction to check payment status
        let transactionId = enrollment.package_transaction_id || enrollment.enrollment_transaction_id;

        if (!transactionId) {
          console.log(`[check-expiring-packages] No transaction found for enrollment ${enrollment.id}, skipping`);
          results.push({
            enrollment_id: enrollment.id,
            status: "skipped",
            reason: "No transaction found"
          });
          continue;
        }

        // Fetch transaction details
        const { data: transaction, error: txError } = await supabase
          .from("transaction_ledger")
          .select("*")
          .eq("id", transactionId)
          .single();

        if (txError || !transaction) {
          console.error(`[check-expiring-packages] Error fetching transaction ${transactionId}:`, txError);
          results.push({
            enrollment_id: enrollment.id,
            status: "error",
            reason: "Transaction not found"
          });
          continue;
        }

        console.log(`[check-expiring-packages] Transaction status: ${transaction.payment_status}`);

        // Decide whether to send invoice or receipt
        if (transaction.payment_status === "paid") {
          // Send receipt for paid members
          console.log(`[check-expiring-packages] Sending receipt to ${transaction.member_email}`);

          const { error: emailError } = await supabase.functions.invoke("send-receipt-email", {
            body: {
              transactionId: transaction.id,
              recipientEmail: transaction.member_email
            }
          });

          if (emailError) {
            console.error(`[check-expiring-packages] Error sending receipt:`, emailError);
            results.push({
              enrollment_id: enrollment.id,
              member_email: transaction.member_email,
              status: "error",
              reason: `Failed to send receipt: ${emailError.message}`
            });
          } else {
            results.push({
              enrollment_id: enrollment.id,
              member_email: transaction.member_email,
              status: "sent",
              email_type: "receipt"
            });
          }

        } else if (transaction.payment_status === "pending" || transaction.payment_status === "failed") {
          // Send invoice for unpaid members
          console.log(`[check-expiring-packages] Sending invoice to ${transaction.member_email}`);

          const { error: emailError } = await supabase.functions.invoke("send-receipt-email", {
            body: {
              transactionId: transaction.id,
              recipientEmail: transaction.member_email
            }
          });

          if (emailError) {
            console.error(`[check-expiring-packages] Error sending invoice:`, emailError);
            results.push({
              enrollment_id: enrollment.id,
              member_email: transaction.member_email,
              status: "error",
              reason: `Failed to send invoice: ${emailError.message}`
            });
          } else {
            results.push({
              enrollment_id: enrollment.id,
              member_email: transaction.member_email,
              status: "sent",
              email_type: "invoice"
            });
          }
        }

      } catch (error: any) {
        console.error(`[check-expiring-packages] Error processing enrollment ${enrollment.id}:`, error);
        results.push({
          enrollment_id: enrollment.id,
          status: "error",
          reason: error.message
        });
      }
    }

    console.log(`[check-expiring-packages] Cron job completed. Processed ${results.length} enrollments`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} expiring enrollments`,
        count: results.length,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[check-expiring-packages] Cron job error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
