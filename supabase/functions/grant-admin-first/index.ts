import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing service credentials");

    const supabase = createClient(url, serviceKey);

    // Check if any roles exist
    const { data: countData, error: countErr } = await supabase.from("user_roles").select("id", { count: "exact", head: true });
    if (countErr) throw countErr;

    if ((countData as any) === null) {
      // fallback if head true does not return data, fetch count separately
      const { count } = await supabase.from("user_roles").select("id", { count: "exact" });
      if (typeof count === "number" && count > 0) {
        return new Response(JSON.stringify({ granted: false, reason: "roles_exist" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // If table empty, grant admin to this user
    const { count } = await supabase.from("user_roles").select("id", { count: "exact" });
    if ((count ?? 0) === 0) {
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id, role: "admin" });
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ granted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ granted: false, reason: "roles_exist" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("grant-admin-first error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
