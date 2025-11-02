import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// List of tables to backup (public schema)
const TABLES_TO_BACKUP = [
  'profiles',
  'user_roles',
  'children',
  'clubs',
  'club_facilities',
  'club_amenities',
  'club_instructors',
  'club_packages',
  'club_members',
  'club_pictures',
  'club_products',
  'club_partners',
  'club_reviews',
  'club_statistics',
  'club_classes',
  'club_community_posts',
  'activities',
  'activity_schedules',
  'activity_skills',
  'package_activities',
  'package_enrollments',
  'membership_requests',
  'membership_history',
  'member_acquired_skills',
  'instructor_certifications',
  'instructor_reviews',
  'facility_operating_hours',
  'facility_pictures',
  'facility_rentable_times',
  'bank_accounts',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has super_admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Super Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting database backup for user:', user.id);

    // Use admin client to access all data
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const backup: Record<string, any[]> = {
      _metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: TABLES_TO_BACKUP,
      }
    };

    // Backup each table
    for (const tableName of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await adminClient
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`Error backing up table ${tableName}:`, error);
          backup[tableName] = [];
        } else {
          backup[tableName] = data || [];
          console.log(`Backed up ${data?.length || 0} rows from ${tableName}`);
        }
      } catch (err) {
        console.error(`Exception backing up table ${tableName}:`, err);
        backup[tableName] = [];
      }
    }

    const backupJson = JSON.stringify(backup, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-backup-${timestamp}.json`;

    console.log('Backup completed successfully, size:', backupJson.length, 'bytes');

    return new Response(backupJson, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create backup' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
