import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateClubOwnerRequest {
  user_id: string;
  club_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, club_id }: CreateClubOwnerRequest = await req.json();

    if (!user_id || !club_id) {
      throw new Error("user_id and club_id are required");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, name")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      throw new Error("User not found");
    }

    // Ensure both admin and business_owner roles exist
    const rolesToEnsure = ["admin", "business_owner"];
    
    for (const role of rolesToEnsure) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: user_id, role },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      if (roleError) throw new Error(`Role error: ${roleError.message}`);
    }

    // Check if already a member of this club
    const { data: existingMembership } = await supabase
      .from("club_members")
      .select("id")
      .eq("user_id", user_id)
      .eq("club_id", club_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!existingMembership) {
      // Add as club member with Owner rank
      const { error: memberError } = await supabase.from("club_members").insert({
        club_id,
        user_id: user_id,
        name: profile.name,
        rank: "Owner",
        is_active: true,
        is_instructor: false,
      });

      if (memberError) throw new Error(`Member error: ${memberError.message}`);
    }

    // Update club's business_owner_id
    const { error: clubUpdateError } = await supabase
      .from("clubs")
      .update({ business_owner_id: user_id })
      .eq("id", club_id);

    if (clubUpdateError) throw new Error(`Club update error: ${clubUpdateError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user_id,
        message: `User ${profile.name} added as club owner`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating club owner:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
