// Remove instructor and create membership history
// - Marks club_members as inactive
// - Records leave date and reason
// - Creates membership_history entry
// - Preserves instructor record for historical reference

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RemoveInstructorRequest {
  instructorId: string;
  leaveReason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify admin
    const {
      data: { user },
      error: getUserError,
    } = await supabaseAuth.auth.getUser();

    if (getUserError || !user) {
      console.error("Authentication failed:", getUserError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles, error: rolesError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    const isAdmin = (roles || []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instructorId, leaveReason }: RemoveInstructorRequest = await req.json();

    console.log("Removing instructor:", instructorId);

    // Get instructor details
    const { data: instructor, error: fetchError } = await supabaseAdmin
      .from("club_instructors")
      .select("*, club_members!club_instructors_member_id_fkey(*)")
      .eq("id", instructorId)
      .single();

    if (fetchError || !instructor) {
      console.error("Instructor not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Instructor not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const member = instructor.club_members;

    if (!member) {
      console.error("No linked member found");
      return new Response(
        JSON.stringify({ error: "No member record found for instructor" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const leftDate = new Date().toISOString().split('T')[0];
    const joinedDate = member.joined_date;
    const durationDays = Math.floor(
      (new Date(leftDate).getTime() - new Date(joinedDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log("Creating membership history for instructor");

    // Create membership history
    const { error: historyError } = await supabaseAdmin
      .from("membership_history")
      .insert({
        user_id: member.user_id,
        child_id: member.child_id,
        club_id: instructor.club_id,
        member_name: instructor.name,
        joined_date: joinedDate,
        left_date: leftDate,
        duration_days: durationDays,
        leave_reason: leaveReason || "Instructor position ended",
      });

    if (historyError) {
      console.error("Error creating history:", historyError);
      throw historyError;
    }

    // Mark member as inactive
    const { error: updateError } = await supabaseAdmin
      .from("club_members")
      .update({
        is_active: false,
        left_date: leftDate,
        leave_reason: leaveReason || "Instructor position ended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (updateError) {
      console.error("Error updating member:", updateError);
      throw updateError;
    }

    console.log("Successfully removed instructor and created history");

    return new Response(
      JSON.stringify({
        success: true,
        memberId: member.id,
        historyCreated: true,
        durationDays,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Error in remove-instructor:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
