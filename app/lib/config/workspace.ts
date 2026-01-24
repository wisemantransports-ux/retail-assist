/**
 * Workspace Configuration
 *
 * Central configuration for workspace constants and identifiers.
 * This ensures consistency across the application and makes future
 * changes easier (e.g., updating the platform workspace ID).
 */

/**
 * Platform Workspace ID
 *
 * UUID for the internal Retail Assist platform workspace.
 * Used to identify platform_staff users and distinguish them from client workspaces.
 *
 * All internal Retail Assist staff have:
 * - role: 'platform_staff'
 * - workspace_id: PLATFORM_WORKSPACE_ID
 */
export const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Valid roles in the system
 */
export const VALID_ROLES = ['super_admin', 'admin', 'employee', 'platform_staff'] as const;

export type ValidRole = (typeof VALID_ROLES)[number];
