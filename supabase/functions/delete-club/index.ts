import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { clubId, clubName } = await req.json()
    
    console.log(`Starting deletion process for club: ${clubId}`)

    // Verify the club exists and name matches
    const { data: club, error: clubError } = await supabaseClient
      .from('clubs')
      .select('id, name')
      .eq('id', clubId)
      .single()

    if (clubError || !club) {
      console.error('Club not found:', clubError)
      return new Response(
        JSON.stringify({ error: 'Club not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (club.name !== clubName) {
      console.error('Club name mismatch')
      return new Response(
        JSON.stringify({ error: 'Club name does not match' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Delete all files from storage related to this club
    console.log('Deleting storage files...')
    
    // List all files in avatars bucket that start with club-{clubId}
    const { data: files, error: listError } = await supabaseClient.storage
      .from('avatars')
      .list('', {
        search: `club-${clubId}`
      })

    if (files && files.length > 0) {
      const filePaths = files.map(file => file.name)
      console.log(`Found ${filePaths.length} files to delete`)
      
      const { error: deleteFilesError } = await supabaseClient.storage
        .from('avatars')
        .remove(filePaths)
      
      if (deleteFilesError) {
        console.error('Error deleting files:', deleteFilesError)
      } else {
        console.log('Storage files deleted successfully')
      }
    } else {
      console.log('No storage files found for this club')
    }

    // 2. Delete the club from database (cascade will handle related records)
    console.log('Deleting club from database...')
    const { error: deleteError } = await supabaseClient
      .from('clubs')
      .delete()
      .eq('id', clubId)

    if (deleteError) {
      console.error('Error deleting club:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Club deleted successfully')
    return new Response(
      JSON.stringify({ success: true, message: 'Club and all related data deleted successfully' }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
