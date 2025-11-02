// Cleanup duplicate owner member entries (e.g., accidental "Beginner" self-records)
// - Allows admins/super_admins to remove their own duplicate club_members rows
// - Super admins may optionally delete a specific memberId

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: getUserError,
    } = await supabaseAuth.auth.getUser();

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has admin or super_admin role
    const { data: roles, error: rolesError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) throw rolesError;

    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    const isSuperAdmin = (roles || []).some((r: any) => r.role === "super_admin");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { scope, memberId } = body || {} as { scope?: string; memberId?: string };

    let deleted = 0;

    if (memberId) {
      // Only super admins can delete arbitrary member IDs
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Only super admins can delete any member" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from("club_members")
        .delete()
        .eq("id", memberId)
        .select("id");
      if (error) throw error;
      deleted = data?.length ?? 0;
    } else {
      // Default safe scope: delete duplicate self records with Beginner rank
      // Protects against accidental owner self-enrollment artifacts
      if (scope !== "self-beginner") {
        return new Response(JSON.stringify({ error: "Invalid scope" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from("club_members")
        .delete()
        .match({ user_id: user.id, rank: "Beginner" })
        .select("id");
      if (error) throw error;
      deleted = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ success: true, deleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error cleaning duplicate member:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});