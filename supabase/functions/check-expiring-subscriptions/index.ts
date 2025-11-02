import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cron job that runs daily to:
 * 1. Send expiration invoices to members with 3 days or less remaining
 * 2. Send renewal reminders for payment day
 * 3. Mark expired subscriptions as inactive
 * 
 * Schedule: Run daily at 9:00 AM
 * 
 * To set up cron:
 * select cron.schedule(
 *   'check-expiring-subscriptions',
 *   '0 9 * * *',  -- Every day at 9 AM
 *   $$
 *   select net.http_post(
 *     url:='https://zcwfreuywtlrrgevhtmo.supabase.co/functions/v1/check-expiring-subscriptions',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
 *   ) as request_id;
 *   $$
 * );
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[check-expiring-subscriptions] Starting daily check...');

    const now = new Date();
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    // Get all active enrollments
    const { data: enrollments, error } = await supabaseAdmin
      .from('package_enrollments')
      .select(`
        id,
        member_id,
        enrolled_at,
        is_active,
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
      .eq('is_active', true);

    if (error) throw error;

    let expirationEmailsSent = 0;
    let renewalRemindersSent = 0;
    let deactivatedCount = 0;

    for (const enrollment of enrollments || []) {
      const enrolledDate = new Date(enrollment.enrolled_at);
      const expiryDate = new Date(enrolledDate);
      expiryDate.setMonth(expiryDate.getMonth() + enrollment.club_packages.duration_months);

      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Get user email
      let memberEmail = '';
      if (enrollment.club_members.user_id) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('user_id', enrollment.club_members.user_id)
          .single();
        memberEmail = profile?.email || '';
      }

      // Get club details
      const { data: club } = await supabaseAdmin
        .from('clubs')
        .select('name, currency')
        .eq('id', enrollment.club_packages.club_id)
        .single();

      // 1. Mark expired subscriptions as inactive
      if (daysRemaining <= 0) {
        await supabaseAdmin
          .from('package_enrollments')
          .update({ is_active: false })
          .eq('id', enrollment.id);

        // Mark member as inactive if no other active enrollments
        const { data: otherEnrollments } = await supabaseAdmin
          .from('package_enrollments')
          .select('id')
          .eq('member_id', enrollment.member_id)
          .eq('is_active', true)
          .neq('id', enrollment.id);

        if (!otherEnrollments || otherEnrollments.length === 0) {
          await supabaseAdmin
            .from('club_members')
            .update({ is_active: false })
            .eq('id', enrollment.member_id);
        }

        deactivatedCount++;
        console.log(`[check-expiring-subscriptions] Deactivated expired enrollment ${enrollment.id}`);
        continue;
      }

      // 2. Send expiration invoice for subscriptions expiring within 3 days
      if (daysRemaining <= 3 && memberEmail) {
        try {
          await supabaseAdmin.functions.invoke('send-subscription-email', {
            body: {
              type: 'expiration_invoice',
              memberName: enrollment.club_members.name,
              memberEmail: memberEmail,
              clubName: club?.name || '',
              packageName: enrollment.club_packages.name,
              packagePrice: enrollment.club_packages.price,
              currency: club?.currency || 'USD',
              durationMonths: enrollment.club_packages.duration_months,
              enrolledDate: enrollment.enrolled_at,
              expiryDate: expiryDate.toISOString()
            }
          });

          expirationEmailsSent++;
          console.log(`[check-expiring-subscriptions] Sent expiration invoice to ${memberEmail}`);
        } catch (emailError) {
          console.error('[check-expiring-subscriptions] Email error:', emailError);
        }
      }

      // 3. Send renewal reminder 3 days before monthly payment date
      // Check if today is 3 days before the monthly anniversary
      const nextPaymentDate = new Date(enrolledDate);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + Math.ceil((now.getTime() - enrolledDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      
      const daysUntilPayment = Math.ceil((nextPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilPayment === 3 && memberEmail) {
        try {
          await supabaseAdmin.functions.invoke('send-subscription-email', {
            body: {
              type: 'renewal_reminder',
              memberName: enrollment.club_members.name,
              memberEmail: memberEmail,
              clubName: club?.name || '',
              packageName: enrollment.club_packages.name,
              packagePrice: enrollment.club_packages.price,
              currency: club?.currency || 'USD',
              durationMonths: enrollment.club_packages.duration_months,
              enrolledDate: enrollment.enrolled_at,
              expiryDate: nextPaymentDate.toISOString()
            }
          });

          renewalRemindersSent++;
          console.log(`[check-expiring-subscriptions] Sent renewal reminder to ${memberEmail}`);
        } catch (emailError) {
          console.error('[check-expiring-subscriptions] Email error:', emailError);
        }
      }
    }

    console.log(`[check-expiring-subscriptions] Complete. Expiration emails: ${expirationEmailsSent}, Renewal reminders: ${renewalRemindersSent}, Deactivated: ${deactivatedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        expiration_emails_sent: expirationEmailsSent,
        renewal_reminders_sent: renewalRemindersSent,
        deactivated_count: deactivatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-expiring-subscriptions] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
