"use client"
import { useEffect } from 'react'
import createBrowserSupabaseClient from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

export default function SupabaseDebugPage() {
  useEffect(() => {
    ;(async () => {
      try {
        // STEP F-2 — Login
        const params = new URLSearchParams(window.location.search)
        const email = params.get('email') || 'newuser@example.com'
        const password = params.get('password') || 'strongpassword'
        const signIn = await supabase.auth.signInWithPassword({ email, password })
        console.log('STEP F-2 SIGNIN', signIn)
        if (signIn.error || !signIn.data) {
          console.error('STEP F-2 FAILED', signIn.error)
          return
        }

        // STEP F-3 — Session verification
        const getUser = await supabase.auth.getUser()
        console.log('STEP F-3 AUTH USER', getUser.data?.user, getUser.error)

        // STEP F-4 — RLS test: users table
        const usersRes = await supabase.from('users').select('id, email, auth_uid')
        console.log('STEP F-4 USERS', usersRes.data, usersRes.error)

        // STEP F-5 — RLS test: workspaces
        const wsRes = await supabase.from('workspaces').select('id, name, owner_id')
        console.log('STEP F-5 WORKSPACES', wsRes.data, wsRes.error)

        // STEP F-6 — RLS test: workspace_members
        const membersRes = await supabase.from('workspace_members').select('workspace_id, user_id, role')
        console.log('STEP F-6 MEMBERS', membersRes.data, membersRes.error)

        // STEP F-7 — RLS test: admin_access
        const adminRes = await supabase.from('admin_access').select('workspace_id, user_id, role')
        console.log('STEP F-7 ADMIN ACCESS', adminRes.data, adminRes.error)

        // STEP F-8 — Negative leakage test helper (requires another workspace id)
        // To run: open the browser console and call
        // window.runNegativeTest('<OTHER_WORKSPACE_ID>')
        ;(window as any).runNegativeTest = async (otherId: string) => {
          const neg = await supabase.from('workspaces').select('*').eq('id', otherId)
          console.log('STEP F-8 NEGATIVE TEST', neg.data, neg.error)
        }

        console.log('Supabase debug steps F-2..F-7 completed. Use window.runNegativeTest for F-8.')
      } catch (err) {
        console.error('Supabase debug error', err)
      }
    })()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase RLS Debug</h1>
      <p>Runs verification steps F-2 through F-7 automatically and logs results to the browser console.</p>
      <p>For STEP F-8, run <code>window.runNegativeTest('&lt;OTHER_WORKSPACE_ID&gt;')</code> in the console.</p>
    </div>
  )
}
