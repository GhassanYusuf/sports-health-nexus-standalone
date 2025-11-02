import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReconcileResult {
  club_id: string;
  club_name: string;
  owner_user_id: string;
  owner_name: string;
  actions: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is super_admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some(r => r.role === "super_admin");
    const { scoped } = await req.json().catch(() => ({ scoped: true }));

    console.log(`Reconciliation started by ${user.id}, super_admin: ${isSuperAdmin}, scoped: ${scoped}`);

    // Fetch clubs to reconcile
    let clubsQuery = supabase
      .from("clubs")
      .select("id, name, business_owner_id");

    if (!isSuperAdmin || scoped) {
      // Non-super admins or scoped mode: only clubs where user is Owner
      const { data: ownedMemberships } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .ilike("rank", "owner")
        .eq("is_active", true);

      const clubIds = ownedMemberships?.map(m => m.club_id) || [];
      
      if (clubIds.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No clubs found where you are the owner",
            results: [] 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      clubsQuery = clubsQuery.in("id", clubIds);
    }

    const { data: clubs, error: clubsError } = await clubsQuery;

    if (clubsError) throw clubsError;

    const results: ReconcileResult[] = [];

    for (const club of clubs || []) {
      const actions: string[] = [];

      // Find the owner member
      const { data: ownerMember } = await supabase
        .from("club_members")
        .select("user_id, name")
        .eq("club_id", club.id)
        .ilike("rank", "owner")
        .eq("is_active", true)
        .maybeSingle();

      if (!ownerMember) {
        console.log(`No owner found for club ${club.name}`);
        continue;
      }

      // Update business_owner_id if missing or mismatched
      if (club.business_owner_id !== ownerMember.user_id) {
        const { error: updateError } = await supabase
          .from("clubs")
          .update({ business_owner_id: ownerMember.user_id })
          .eq("id", club.id);

        if (updateError) {
          console.error(`Failed to update club ${club.name}:`, updateError);
        } else {
          actions.push("linked business_owner_id");
        }
      }

      // Ensure both admin and business_owner roles exist
      const rolesToEnsure = ["admin", "business_owner"];
      
      for (const role of rolesToEnsure) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            { user_id: ownerMember.user_id, role },
            { onConflict: "user_id,role", ignoreDuplicates: true }
          );

        if (roleError) {
          console.error(`Failed to upsert role ${role} for user ${ownerMember.user_id}:`, roleError);
        } else {
          actions.push(`granted ${role} role`);
        }
      }

      if (actions.length > 0) {
        results.push({
          club_id: club.id,
          club_name: club.name,
          owner_user_id: ownerMember.user_id,
          owner_name: ownerMember.name,
          actions,
        });
      }
    }

    console.log("Reconciliation complete:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reconciled ${results.length} club(s)`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error reconciling club owners:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
