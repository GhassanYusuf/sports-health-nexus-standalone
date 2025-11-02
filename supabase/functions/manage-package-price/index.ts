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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { package_id, new_price } = await req.json();

    console.log(`[manage-package-price] Processing package ${package_id} with new price: ${new_price}`);

    // Get current active price version
    const { data: currentVersion } = await supabaseAdmin
      .from('package_price_history')
      .select('*')
      .eq('package_id', package_id)
      .is('valid_until', null)
      .single();

    // If price hasn't changed, return current version
    if (currentVersion && parseFloat(currentVersion.price) === parseFloat(new_price)) {
      console.log(`[manage-package-price] Price unchanged, returning existing version`);
      return new Response(
        JSON.stringify({ version_id: currentVersion.id, unchanged: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get club's current VAT rate
    const { data: pkg } = await supabaseAdmin
      .from('club_packages')
      .select('club_id')
      .eq('id', package_id)
      .single();

    if (!pkg) {
      throw new Error('Package not found');
    }

    const { data: club } = await supabaseAdmin
      .from('clubs')
      .select('vat_percentage')
      .eq('id', pkg.club_id)
      .single();

    if (!club) {
      throw new Error('Club not found');
    }

    const now = new Date().toISOString();

    // Close current version if exists
    if (currentVersion) {
      console.log(`[manage-package-price] Closing previous version ${currentVersion.id}`);
      await supabaseAdmin
        .from('package_price_history')
        .update({ valid_until: now })
        .eq('id', currentVersion.id);
    }

    // Create new version
    const { data: newVersion, error } = await supabaseAdmin
      .from('package_price_history')
      .insert({
        package_id,
        price: new_price,
        vat_percentage: club.vat_percentage || 0,
        valid_from: now,
        valid_until: null
      })
      .select()
      .single();

    if (error) throw error;

    // Update package's current price
    await supabaseAdmin
      .from('club_packages')
      .update({ price: new_price, updated_at: now })
      .eq('id', package_id);

    console.log(`[manage-package-price] Created price version ${newVersion.id} with price ${new_price}`);

    return new Response(
      JSON.stringify({ version_id: newVersion.id, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[manage-package-price] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
