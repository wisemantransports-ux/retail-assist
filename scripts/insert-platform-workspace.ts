import { createAdminSupabaseClient } from '../app/lib/supabase/server';

/**
 * Insert the platform workspace
 * This script ensures the PLATFORM_WORKSPACE_ID exists in the database
 */
const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const SUPER_ADMIN_USER_ID = '0d5ff8c7-31ac-4d5f-8c4c-556d8bd08ab7'; // From migration 031

async function insertPlatformWorkspace() {
  try {
    console.log('[Platform Workspace] Inserting platform workspace...');
    
    const admin = createAdminSupabaseClient();

    // Try to insert
    const { data, error } = await admin
      .from('workspaces')
      .insert({
        id: PLATFORM_WORKSPACE_ID,
        owner_id: SUPER_ADMIN_USER_ID,
        name: 'Retail Assist Platform',
        description: 'Internal platform workspace for platform employees',
      })
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, it already exists (which is fine)
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        console.log('[Platform Workspace] ✓ Platform workspace already exists');
        
        // Verify it exists
        const { data: existing } = await admin
          .from('workspaces')
          .select('*')
          .eq('id', PLATFORM_WORKSPACE_ID)
          .single();
        
        if (existing) {
          console.log('[Platform Workspace] ✓ Verified workspace exists:', existing);
          process.exit(0);
        }
      } else {
        console.error('[Platform Workspace] Error inserting:', error);
        process.exit(1);
      }
    } else {
      console.log('[Platform Workspace] ✓ Successfully inserted:', data);
      process.exit(0);
    }
  } catch (error) {
    console.error('[Platform Workspace] Unexpected error:', error);
    process.exit(1);
  }
}

insertPlatformWorkspace();
