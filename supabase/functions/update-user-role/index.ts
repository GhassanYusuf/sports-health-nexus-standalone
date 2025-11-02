import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing service credentials");

    const supabaseAuth = createClient(url, serviceKey);
    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the calling user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super_admin
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerRole || callerRole.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only super admins can update user roles" }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { targetEmail, newRole, clubId } = await req.json();

    if (!targetEmail || !newRole) {
      return new Response(
        JSON.stringify({ error: "targetEmail and newRole are required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user by email
    const { data: { users }, error: userListError } = await supabaseAuth.auth.admin.listUsers();
    if (userListError) throw userListError;

    const targetUser = users.find(u => u.email === targetEmail);
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: `User with email ${targetEmail} not found` }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existingRole) {
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", targetUser.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: targetUser.id, role: newRole });

      if (insertError) throw insertError;
    }

    // If role is business_owner and clubId is provided, link to club
    if (newRole === "business_owner" && clubId) {
      const { error: clubError } = await supabase
        .from("clubs")
        .update({ business_owner_id: targetUser.id })
        .eq("id", clubId);

      if (clubError) throw clubError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${targetEmail} to ${newRole}`,
        user_id: targetUser.id 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("update-user-role error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
