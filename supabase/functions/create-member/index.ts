// Create a new member with auth user and profile securely
// - Validates the caller is admin/super_admin
// - Creates auth user with service role key
// - Creates profile and optionally children

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateMemberRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  country_code: string;
  gender: string;
  date_of_birth: string;
  nationality: string;
  address?: string;
  blood_type?: string;
  avatar_url?: string;
  children?: Array<{
    name: string;
    gender: string;
    date_of_birth: string;
    nationality: string;
    avatar_url?: string;
    blood_type?: string;
  }>;
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
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client bound to the caller to check their role
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client to perform privileged operations
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

    // Verify caller is admin or super_admin
    const { data: roles, error: rolesError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    const isAllowed = (roles || []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin" || r.role === "business_owner"
    );

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberData: CreateMemberRequest = await req.json();

    if (!memberData.email || !memberData.password || !memberData.name || 
        !memberData.phone || !memberData.gender || !memberData.date_of_birth || 
        !memberData.nationality) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === memberData.email);
    
    let userId: string;
    
    if (existingUser) {
      // User already exists, use their ID
      userId = existingUser.id;
      console.log(`User already exists: ${userId}`);
      
      // Update their profile with new information
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          name: memberData.name,
          phone: memberData.phone,
          country_code: memberData.country_code,
          gender: memberData.gender,
          date_of_birth: memberData.date_of_birth,
          nationality: memberData.nationality,
          address: memberData.address || null,
          blood_type: memberData.blood_type || null,
          avatar_url: memberData.avatar_url || null,
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;
      console.log(`Updated profile for existing user: ${userId}`);
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: memberData.email,
        password: memberData.password,
        email_confirm: true,
        user_metadata: {
          name: memberData.name,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      userId = authData.user.id;
      console.log(`Created new auth user: ${userId}`);

      // Update profile (trigger already created it)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          name: memberData.name,
          phone: memberData.phone,
          country_code: memberData.country_code,
          gender: memberData.gender,
          date_of_birth: memberData.date_of_birth,
          nationality: memberData.nationality,
          address: memberData.address || null,
          blood_type: memberData.blood_type || null,
          avatar_url: memberData.avatar_url || null,
          email: memberData.email,
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;
      console.log(`Created profile for new user: ${userId}`);
    }

    // Create child members if provided
    let childrenCreated = 0;
    if (memberData.children && memberData.children.length > 0) {
      const validChildren = memberData.children.filter(
        (child) => child.name && child.gender && child.date_of_birth && child.nationality
      );
      
      if (validChildren.length > 0) {
        const { error: childrenError } = await supabaseAdmin
          .from("children")
          .insert(
            validChildren.map((child) => ({
              parent_user_id: userId,
              name: child.name,
              gender: child.gender,
              date_of_birth: child.date_of_birth,
              nationality: child.nationality,
              avatar_url: child.avatar_url || null,
              blood_type: child.blood_type || null,
            }))
          );

        if (childrenError) throw childrenError;
        childrenCreated = validChildren.length;
        console.log(`Created ${childrenCreated} children for user: ${userId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        children_created: childrenCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error creating member:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
