import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GraduateChildRequest {
  child_id: string;
  email: string;
  password: string;
  phone: string;
  country_code: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { child_id, email, password, phone, country_code }: GraduateChildRequest = await req.json();

    console.log('Starting child graduation process for child_id:', child_id);

    // 1. Fetch child data
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('*')
      .eq('id', child_id)
      .single();

    if (childError || !child) {
      throw new Error('Child not found');
    }

    console.log('Child data retrieved:', { name: child.name, parent_user_id: child.parent_user_id });

    // 2. Create auth user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: child.name,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create auth account: ${authError?.message}`);
    }

    console.log('Auth account created:', authData.user.id);

    // 3. Get parent's nationality from their profile
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('nationality')
      .eq('user_id', child.parent_user_id)
      .single();

    // 4. Create profile for new adult member
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        name: child.name,
        phone,
        country_code,
        gender: child.gender,
        date_of_birth: child.date_of_birth,
        blood_type: child.blood_type,
        nationality: parentProfile?.nationality || 'Unknown',
        avatar_url: child.avatar_url,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log('Profile created successfully');

    // 5. Update all active club memberships from child_id to user_id
    const { data: activeMembers, error: fetchMembersError } = await supabase
      .from('club_members')
      .select('*')
      .eq('child_id', child_id)
      .eq('is_active', true);

    if (fetchMembersError) {
      console.error('Error fetching active memberships:', fetchMembersError);
      throw new Error(`Failed to fetch memberships: ${fetchMembersError.message}`);
    }

    console.log('Active memberships found:', activeMembers?.length || 0);

    if (activeMembers && activeMembers.length > 0) {
      const { error: updateMembersError } = await supabase
        .from('club_members')
        .update({
          user_id: authData.user.id,
          child_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('child_id', child_id)
        .eq('is_active', true);

      if (updateMembersError) {
        console.error('Error updating memberships:', updateMembersError);
        throw new Error(`Failed to update memberships: ${updateMembersError.message}`);
      }

      console.log('Active memberships transferred to new user account');
    }

    // 6. Update membership history to link to new user_id (but keep child_id for historical reference)
    const { error: historyError } = await supabase
      .from('membership_history')
      .update({
        user_id: authData.user.id,
      })
      .eq('child_id', child_id);

    if (historyError) {
      console.error('Error updating history:', historyError);
      // Don't throw here, history update is not critical
    } else {
      console.log('Membership history linked to new user account');
    }

    // 7. Keep the child record intact for historical reference
    // Don't delete it - it's part of the history

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Child graduated to adult member successfully',
        new_user_id: authData.user.id,
        transferred_memberships: activeMembers?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in graduate-child function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
