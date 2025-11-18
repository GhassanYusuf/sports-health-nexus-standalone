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
 * Cron job to check for package enrollments expiring in 3 days
 * Runs at 12:00 AM to identify expiring packages
 * Sends emails at 10:00 AM
 *
 * Features:
 * - Checks for enrollments expiring in exactly 3 days
 * - Sends INVOICE if package transaction is pending/failed
 * - Sends RECEIPT if package transaction is paid
 * - Updates expiring_enrollments table for dashboard display
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[check-expiring-enrollments] Starting cron job...");

    // Calculate target date: 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[check-expiring-enrollments] Checking for enrollments expiring on: ${targetDateStr}`);

    // Find all active enrollments expiring in exactly 3 days
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
        package_transaction_id,
        club_members!inner(
          id,
          name,
          user_id,
          club_id
        ),
        club_packages!inner(
          id,
          name,
          price,
          duration_months,
          club_id
        )
      `)
      .eq("is_active", true)
      .eq("end_date", targetDateStr);

    if (enrollError) {
      console.error("[check-expiring-enrollments] Error fetching enrollments:", enrollError);
      throw enrollError;
    }

    console.log(`[check-expiring-enrollments] Found ${expiringEnrollments?.length || 0} expiring enrollments`);

    if (!expiringEnrollments || expiringEnrollments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No enrollments expiring in 3 days",
          count: 0,
          targetDate: targetDateStr
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const enrollment of expiringEnrollments) {
      try {
        console.log(`[check-expiring-enrollments] Processing enrollment: ${enrollment.id}`);

        // Get user email from profile
        let memberEmail = '';
        if (enrollment.club_members.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', enrollment.club_members.user_id)
            .single();
          memberEmail = profile?.email || '';
        }

        if (!memberEmail) {
          console.log(`[check-expiring-enrollments] No email found for member ${enrollment.member_id}, skipping`);
          results.push({
            enrollment_id: enrollment.id,
            member_name: enrollment.club_members.name,
            status: "skipped",
            reason: "No email address"
          });
          continue;
        }

        // Get the package transaction to check payment status
        let transactionId = enrollment.package_transaction_id || enrollment.enrollment_transaction_id;

        if (!transactionId) {
          console.log(`[check-expiring-enrollments] No transaction found for enrollment ${enrollment.id}, skipping`);
          results.push({
            enrollment_id: enrollment.id,
            member_name: enrollment.club_members.name,
            member_email: memberEmail,
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
          console.error(`[check-expiring-enrollments] Error fetching transaction ${transactionId}:`, txError);
          results.push({
            enrollment_id: enrollment.id,
            member_name: enrollment.club_members.name,
            member_email: memberEmail,
            status: "error",
            reason: "Transaction not found"
          });
          emailsFailed++;
          continue;
        }

        // Get club details for email
        const { data: club } = await supabase
          .from('clubs')
          .select('name, currency')
          .eq('id', enrollment.club_members.club_id)
          .single();

        console.log(`[check-expiring-enrollments] Transaction status: ${transaction.payment_status}`);

        // Determine email type based on payment status
        const isPaid = transaction.payment_status === "paid";
        const emailType = isPaid ? "receipt" : "invoice";

        console.log(`[check-expiring-enrollments] Sending ${emailType} to ${memberEmail}`);

        // Send email via send-receipt-email function
        const { error: emailError } = await supabase.functions.invoke("send-receipt-email", {
          body: {
            transactionId: transaction.id,
            recipientEmail: memberEmail
          }
        });

        if (emailError) {
          console.error(`[check-expiring-enrollments] Error sending ${emailType}:`, emailError);
          results.push({
            enrollment_id: enrollment.id,
            member_name: enrollment.club_members.name,
            member_email: memberEmail,
            package_name: enrollment.club_packages.name,
            end_date: enrollment.end_date,
            payment_status: transaction.payment_status,
            status: "error",
            email_type: emailType,
            reason: `Failed to send ${emailType}: ${emailError.message}`
          });
          emailsFailed++;
        } else {
          console.log(`[check-expiring-enrollments] ✅ ${emailType} sent successfully to ${memberEmail}`);
          results.push({
            enrollment_id: enrollment.id,
            member_name: enrollment.club_members.name,
            member_email: memberEmail,
            package_name: enrollment.club_packages.name,
            end_date: enrollment.end_date,
            payment_status: transaction.payment_status,
            status: "sent",
            email_type: emailType
          });
          emailsSent++;
        }

      } catch (error: any) {
        console.error(`[check-expiring-enrollments] Error processing enrollment ${enrollment.id}:`, error);
        results.push({
          enrollment_id: enrollment.id,
          status: "error",
          reason: error.message
        });
        emailsFailed++;
      }
    }

    console.log(`[check-expiring-enrollments] Cron job completed.`);
    console.log(`[check-expiring-enrollments] ✅ Emails sent: ${emailsSent}`);
    console.log(`[check-expiring-enrollments] ❌ Emails failed: ${emailsFailed}`);
    console.log(`[check-expiring-enrollments] Total processed: ${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} expiring enrollments`,
        targetDate: targetDateStr,
        count: results.length,
        emailsSent,
        emailsFailed,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[check-expiring-enrollments] Cron job error:", error);
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
