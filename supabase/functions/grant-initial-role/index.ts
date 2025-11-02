import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GrantRoleRequest {
  role: 'user' | 'business_owner';
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { role }: GrantRoleRequest = await req.json();

    // Validate role
    if (!role || !['user', 'business_owner'].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Only 'user' or 'business_owner' allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has a role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingRole) {
      // User already has a role, just return success
      console.log(`User ${user.id} already has role: ${existingRole.role}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `User already has role: ${existingRole.role}`,
          role: existingRole.role,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Grant the requested role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role });

    if (roleError) {
      console.error("Role insert error:", roleError);
      throw new Error(`Failed to grant role: ${roleError.message}`);
    }

    console.log(`Granted ${role} role to user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Role ${role} granted successfully`,
        role: role,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error granting initial role:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
