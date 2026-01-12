"use client"

import { useEffect, useState } from 'react'
import createBrowserSupabaseClient from '@/lib/supabase/client'

export default function TestClientPage() {
  const [out, setOut] = useState<any>({ status: 'starting' })
  useEffect(() => {
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const email = params.get('email') || ''
        const password = params.get('password') || ''
        const supabase = createBrowserSupabaseClient()

        if (!email || !password) {
          setOut({ error: 'email and password query params required' })
          return
        }

        const signIn = await supabase.auth.signInWithPassword({ email, password })
        const session = await supabase.auth.getSession()
        setOut({ signIn, session })
      } catch (e) {
        setOut({ error: String(e) })
      }
    })()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Test Client SignIn</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(out, null, 2)}</pre>
    </div>
  )
}
