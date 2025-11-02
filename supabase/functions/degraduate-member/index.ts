import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DegradeateMemberRequest {
  user_id: string;
  parent_user_id: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, parent_user_id }: DegradeateMemberRequest = await req.json();

    console.log('Starting member degraduation process for user_id:', user_id);

    // 1. Fetch user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    console.log('User profile retrieved:', { name: profile.name });

    // 2. Verify parent exists
    const { data: parentProfile, error: parentError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', parent_user_id)
      .single();

    if (parentError || !parentProfile) {
      throw new Error('Parent user not found');
    }

    // 3. Create or update child record
    const { data: existingChild } = await supabase
      .from('children')
      .select('id')
      .eq('parent_user_id', parent_user_id)
      .eq('name', profile.name)
      .eq('date_of_birth', profile.date_of_birth)
      .maybeSingle();

    let child_id: string;

    if (existingChild) {
      // Update existing child record
      child_id = existingChild.id;
      const { error: updateChildError } = await supabase
        .from('children')
        .update({
          gender: profile.gender,
          blood_type: profile.blood_type,
          avatar_url: profile.avatar_url,
        })
        .eq('id', child_id);

      if (updateChildError) {
        console.error('Error updating child record:', updateChildError);
        throw new Error(`Failed to update child record: ${updateChildError.message}`);
      }
    } else {
      // Create new child record
      const { data: newChild, error: createChildError } = await supabase
        .from('children')
        .insert({
          parent_user_id,
          name: profile.name,
          gender: profile.gender,
          date_of_birth: profile.date_of_birth,
          blood_type: profile.blood_type,
          avatar_url: profile.avatar_url,
        })
        .select('id')
        .single();

      if (createChildError || !newChild) {
        console.error('Error creating child record:', createChildError);
        throw new Error(`Failed to create child record: ${createChildError?.message}`);
      }

      child_id = newChild.id;
    }

    console.log('Child record ready:', child_id);

    // 4. Update all active club memberships from user_id to child_id
    const { data: activeMembers, error: fetchMembersError } = await supabase
      .from('club_members')
      .select('*')
      .eq('user_id', user_id)
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
          user_id: null,
          child_id: child_id,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)
        .eq('is_active', true);

      if (updateMembersError) {
        console.error('Error updating memberships:', updateMembersError);
        throw new Error(`Failed to update memberships: ${updateMembersError.message}`);
      }

      console.log('Active memberships transferred to child status');
    }

    // 5. Update membership history to link to child_id (but keep user_id for historical reference)
    const { error: historyError } = await supabase
      .from('membership_history')
      .update({
        child_id: child_id,
      })
      .eq('user_id', user_id);

    if (historyError) {
      console.error('Error updating history:', historyError);
      // Don't throw here, history update is not critical
    } else {
      console.log('Membership history linked to child record');
    }

    // 6. Disable auth account (don't delete it to preserve history)
    const { error: disableAuthError } = await supabase.auth.admin.updateUserById(
      user_id,
      { 
        email: `disabled_${user_id}@degraduated.local`,
        email_confirm: false,
      }
    );

    if (disableAuthError) {
      console.error('Error disabling auth account:', disableAuthError);
      // Continue anyway, profile deactivation is more important
    } else {
      console.log('Auth account disabled');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Member degraduated to child successfully',
        child_id: child_id,
        parent_user_id: parent_user_id,
        transferred_memberships: activeMembers?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in degraduate-member function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
