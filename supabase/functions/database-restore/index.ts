import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Super Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting database restore for user:', user.id);

    // Get the backup payload (support JSON body, raw text, or wrapped payloads)
    const contentType = req.headers.get('Content-Type') || req.headers.get('content-type') || '';
    console.log('Incoming restore request Content-Type:', contentType);

    let parsedBody: any = null;
    let backupText: string | null = null;
    let backup: any = null;

    // Try parsing JSON body first (supabase-js usually JSON-encodes the body)
    try {
      parsedBody = await req.json();
      console.log('Parsed JSON body type:', typeof parsedBody);
    } catch (_jsonErr) {
      // Not JSON or empty, will try reading as text below
      parsedBody = null;
    }

    if (parsedBody !== null) {
      if (typeof parsedBody === 'string') {
        // Body is a JSON-encoded string containing the backup JSON
        backupText = parsedBody;
      } else if (parsedBody && typeof parsedBody === 'object') {
        // Either the backup object itself or wrapped in a property
        if (parsedBody._metadata) {
          backup = parsedBody;
        } else if (typeof parsedBody.backup === 'string') {
          backupText = parsedBody.backup;
        } else if (parsedBody.backup && typeof parsedBody.backup === 'object' && parsedBody.backup._metadata) {
          backup = parsedBody.backup;
        } else if (typeof parsedBody.data === 'string') {
          backupText = parsedBody.data;
        }
      }
    }

    // Fallback: try raw text
    if (!backup && !backupText) {
      const rawText = await req.text();
      if (rawText && rawText.trim().length > 0) {
        backupText = rawText;
      }
    }

    if (!backup && (!backupText || backupText.trim().length === 0)) {
      console.error('No backup file provided or empty request body');
      return new Response(JSON.stringify({ error: 'No backup file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate backup JSON
    if (!backup) {
      try {
        backup = JSON.parse(backupText!);
        console.log('Backup parsed successfully');
      } catch (e) {
        console.error('Failed to parse backup JSON:', e);
        return new Response(
          JSON.stringify({ error: 'Invalid backup format. Please upload a valid JSON backup file. Error: ' + (e as any).message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Validate backup structure
    if (!backup._metadata || !backup._metadata.tables) {
      console.error('Invalid backup structure - missing metadata');
      return new Response(
        JSON.stringify({ error: 'Invalid backup format. Missing metadata.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Backup metadata validated:', backup._metadata);

    // Check if service role key is available
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service role key not configured. Cannot restore database.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use admin client to restore data
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    const tables = backup._metadata.tables as string[];

    // Order tables to respect dependencies (parents first)
    const PREFERRED_ORDER = [
      'profiles',
      'user_roles',
      'children',
      'clubs',
      'club_facilities',
      'facility_operating_hours',
      'facility_rentable_times',
      'facility_pictures',
      'club_amenities',
      'club_classes',
      'activities',
      'activity_schedules',
      'activity_skills',
      'club_packages',
      'club_members',
      'package_activities',
      'package_enrollments',
      'club_instructors',
      'instructor_certifications',
      'instructor_reviews',
      'club_pictures',
      'club_products',
      'club_partners',
      'club_reviews',
      'club_statistics',
      'club_community_posts',
      'membership_requests',
      'membership_history',
      'member_acquired_skills',
      'bank_accounts',
    ];

    const orderIndex = new Map(PREFERRED_ORDER.map((t, i) => [t, i]));
    const orderedTables = [...tables].sort(
      (a, b) => (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999)
    );

    let restoredCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const tableResults: Record<string, { restored: boolean; inserted: number; error?: string }> = {};

    console.log(`Starting to restore ${orderedTables.length} tables...`);

    // Restore each table
    for (const tableName of orderedTables) {
      const tableData = backup[tableName];

      if (!tableData || !Array.isArray(tableData)) {
        console.log(`Skipping ${tableName} - no data or invalid format`);
        continue;
      }

      if (tableData.length === 0) {
        console.log(`Skipping ${tableName} - empty table`);
        continue;
      }

      try {
        console.log(`Processing table ${tableName} with ${tableData.length} rows...`);

        // Delete existing data (be careful!)
        const { error: deleteError } = await adminClient
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          console.error(`Error clearing table ${tableName}:`, deleteError.message);
          errors.push(`Failed to clear ${tableName}: ${deleteError.message}`);
        } else {
          console.log(`Cleared table ${tableName}`);
        }

        // Insert backup data in batches
        const batchSize = 100;
        let insertedRows = 0;

        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize);
          const { error: insertError } = await adminClient
            .from(tableName)
            .insert(batch);

          if (insertError) {
            console.error(`Error inserting batch into ${tableName}:`, insertError.message);
            errors.push(`Failed to insert into ${tableName}: ${insertError.message}`);
            tableResults[tableName] = { restored: false, inserted: insertedRows, error: insertError.message };
            errorCount++;
            break; // Stop processing this table on first error
          } else {
            insertedRows += batch.length;
          }
        }

        if (insertedRows > 0) {
          console.log(`Successfully restored ${insertedRows} rows to ${tableName}`);
          tableResults[tableName] = { restored: true, inserted: insertedRows };
          restoredCount++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Exception restoring table ${tableName}:`, errorMsg);
        errors.push(`Exception on ${tableName}: ${errorMsg}`);
        tableResults[tableName] = { restored: false, inserted: 0, error: errorMsg };
        errorCount++;
      }
    }

    console.log('Database restore completed');
    console.log(`Successfully restored: ${restoredCount} tables`);
    console.log(`Errors: ${errorCount} tables`);

    if (errors.length > 0) {
      console.log('Errors encountered:', errors);
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: errorCount === 0
          ? 'Database restored successfully'
          : `Database restored with ${errorCount} error(s). ${restoredCount} table(s) restored successfully.`,
        details: {
          tablesRestored: restoredCount,
          errors: errorCount,
          totalTables: orderedTables.length,
          failedTables: Object.entries(tableResults)
            .filter(([, v]) => !v.restored)
            .map(([k]) => k),
          tableResults,
          errorMessages: errors.slice(0, 20)
        }
      }),
      {
        status: errorCount === 0 ? 200 : 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Restore error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to restore database' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});