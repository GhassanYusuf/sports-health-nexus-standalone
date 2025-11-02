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
      member_id,
      package_id,
      club_id,
      enrolled_at
    } = await req.json();

    console.log(`[process-subscription-workflow] Processing subscription for member ${member_id}`);

    // Get member details
    const { data: member } = await supabaseAdmin
      .from('club_members')
      .select('name, user_id, child_id')
      .eq('id', member_id)
      .single();

    // Get package details
    const { data: packageData } = await supabaseAdmin
      .from('club_packages')
      .select('name, price, duration_months')
      .eq('id', package_id)
      .single();

    // Get club details
    const { data: club } = await supabaseAdmin
      .from('clubs')
      .select('name, currency, business_owner_id')
      .eq('id', club_id)
      .single();

    // Get user email
    let memberEmail = '';
    if (member.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('user_id', member.user_id)
        .single();
      memberEmail = profile?.email || '';
    }

    // Calculate expiry date
    const enrolledDate = new Date(enrolled_at);
    const expiryDate = new Date(enrolledDate);
    expiryDate.setMonth(expiryDate.getMonth() + packageData.duration_months);

    // 1. Create notification for admin
    if (club.business_owner_id) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: club.business_owner_id,
          club_id: club_id,
          type: 'subscription',
          title: 'New Subscription',
          message: `${member.name} subscribed to ${packageData.name}`,
          action_url: '/admin'
        });

      console.log('[process-subscription-workflow] Admin notification created');
    }

    // 2. Send thank you email if we have email
    if (memberEmail) {
      try {
        await supabaseAdmin.functions.invoke('send-subscription-email', {
          body: {
            type: 'thank_you',
            memberName: member.name,
            memberEmail: memberEmail,
            clubName: club.name,
            packageName: packageData.name,
            packagePrice: packageData.price,
            currency: club.currency || 'USD',
            durationMonths: packageData.duration_months,
            enrolledDate: enrolled_at
          }
        });

        console.log('[process-subscription-workflow] Thank you email sent');
      } catch (emailError) {
        console.error('[process-subscription-workflow] Email error:', emailError);
        // Don't fail the whole process if email fails
      }
    }

    // Members can enroll in multiple packages and renew existing subscriptions
    console.log('[process-subscription-workflow] Subscription processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        expiry_date: expiryDate.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-subscription-workflow] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
