// Create instructor with proper club_members integration
// - Creates/updates club_members record
// - Links instructor to member record
// - Handles both new and existing members

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInstructorRequest {
  clubId: string;
  userId?: string; // Optional: if linking to existing user
  instructorData: {
    name: string;
    specialty: string;
    experience: string;
    bio?: string;
    achievements?: string;
    certifications?: string;
    image_url?: string;
    specialty_tags?: string[];
  };
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

    // Client with user auth to verify permissions
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged operations
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify user is authenticated and has admin role
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

    if (rolesError) {
      console.error("Error checking roles:", rolesError);
      throw rolesError;
    }

    const isAdmin = (roles || []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );

    if (!isAdmin) {
      console.error("User is not admin");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateInstructorRequest = await req.json();
    const { clubId, userId, instructorData } = payload;

    console.log("Creating instructor for club:", clubId);

    // Step 1: Create or get club_members record
    let memberId: string;

    // Check if member already exists for this user/club
    if (userId) {
      const { data: existingMember } = await supabaseAdmin
        .from("club_members")
        .select("id, is_active")
        .eq("club_id", clubId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMember) {
        memberId = existingMember.id;
        
        // Update to active and mark as instructor if needed
        const { error: updateError } = await supabaseAdmin
          .from("club_members")
          .update({ 
            is_active: true, 
            is_instructor: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", memberId);

        if (updateError) {
          console.error("Error updating member:", updateError);
          throw updateError;
        }
        
        console.log("Updated existing member:", memberId);
      } else {
        // Create new member record
        const { data: newMember, error: memberError } = await supabaseAdmin
          .from("club_members")
          .insert({
            club_id: clubId,
            user_id: userId,
            name: instructorData.name,
            avatar_url: instructorData.image_url,
            rank: "Instructor",
            is_active: true,
            is_instructor: true,
            joined_date: new Date().toISOString().split('T')[0],
          })
          .select("id")
          .single();

        if (memberError) {
          console.error("Error creating member:", memberError);
          throw memberError;
        }

        memberId = newMember.id;
        console.log("Created new member:", memberId);
      }
    } else {
      // No user ID provided - create member without user_id
      const { data: newMember, error: memberError } = await supabaseAdmin
        .from("club_members")
        .insert({
          club_id: clubId,
          name: instructorData.name,
          avatar_url: instructorData.image_url,
          rank: "Instructor",
          is_active: true,
          is_instructor: true,
          joined_date: new Date().toISOString().split('T')[0],
        })
        .select("id")
        .single();

      if (memberError) {
        console.error("Error creating member:", memberError);
        throw memberError;
      }

      memberId = newMember.id;
      console.log("Created new member without user:", memberId);
    }

    // Fetch the member's display name for legacy matching
    let memberName: string | null = null;
    const { data: memberRow } = await supabaseAdmin
      .from("club_members")
      .select("name")
      .eq("id", memberId)
      .maybeSingle();
    memberName = memberRow?.name ?? instructorData.name;

    // Step 2: Upsert instructor record linked to member
    // First, see if an instructor already exists for this member in this club
    const { data: existingInstructorByMember, error: existingByMemberError } = await supabaseAdmin
      .from("club_instructors")
      .select("id")
      .eq("club_id", clubId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (existingByMemberError) {
      console.error("Error checking existing instructor by member:", existingByMemberError);
    }

    if (existingInstructorByMember) {
      // Update existing instructor instead of creating a new one
      const { data: updated, error: updateInstructorError } = await supabaseAdmin
        .from("club_instructors")
        .update({
          name: instructorData.name,
          specialty: instructorData.specialty,
          experience: instructorData.experience,
          bio: instructorData.bio || null,
          achievements: instructorData.achievements || null,
          certifications: instructorData.certifications || null,
          image_url: instructorData.image_url || null,
          specialty_tags: instructorData.specialty_tags || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingInstructorByMember.id)
        .select()
        .single();

      if (updateInstructorError) {
        console.error("Error updating existing instructor:", updateInstructorError);
        throw updateInstructorError;
      }

      console.log("Updated existing instructor:", updated.id);
      return new Response(
        JSON.stringify({ success: true, instructor: updated, memberId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to link any existing instructor record in this club with a similar name (legacy records without member_id)
    const { data: legacyInstructor, error: legacyError } = await supabaseAdmin
      .from("club_instructors")
      .select("id")
      .eq("club_id", clubId)
      .is("member_id", null)
      .or(
        `name.eq.${instructorData.name},name.ilike.%${(memberName || instructorData.name).replace(/%/g, '')}%`
      )
      .maybeSingle();

    if (legacyError) {
      console.warn("Error checking legacy instructor by name:", legacyError);
    }

    if (legacyInstructor) {
      const { data: linked, error: linkError } = await supabaseAdmin
        .from("club_instructors")
        .update({
          member_id: memberId,
          name: instructorData.name,
          specialty: instructorData.specialty,
          experience: instructorData.experience,
          bio: instructorData.bio || null,
          achievements: instructorData.achievements || null,
          certifications: instructorData.certifications || null,
          image_url: instructorData.image_url || null,
          specialty_tags: instructorData.specialty_tags || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", legacyInstructor.id)
        .select()
        .single();

      if (linkError) {
        console.error("Error linking legacy instructor:", linkError);
        throw linkError;
      }

      console.log("Linked legacy instructor to member:", linked.id);
      return new Response(
        JSON.stringify({ success: true, instructor: linked, memberId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No existing found, create new instructor linked to member
    const { data: instructor, error: instructorError } = await supabaseAdmin
      .from("club_instructors")
      .insert({
        club_id: clubId,
        member_id: memberId,
        name: instructorData.name,
        specialty: instructorData.specialty,
        experience: instructorData.experience,
        bio: instructorData.bio || null,
        achievements: instructorData.achievements || null,
        certifications: instructorData.certifications || null,
        image_url: instructorData.image_url || null,
        specialty_tags: instructorData.specialty_tags || [],
      })
      .select()
      .single();

    if (instructorError) {
      console.error("Error creating instructor:", instructorError);
      throw instructorError;
    }

    console.log("Successfully created instructor:", instructor.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        instructor,
        memberId 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Error in create-instructor:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
