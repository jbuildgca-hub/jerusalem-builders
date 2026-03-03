import { useEffect } from 'react'
import { supabase, profiles } from '../lib/supabase'
import { useAuthStore, useAppStore } from '../store'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()
  const { fetchStats, fetchAlerts } = useAppStore()

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await profiles.get(session.user.id)
        if (profile) {
          setUser(profile)
        } else {
          // Fallback: create minimal profile from auth user
          const fallback = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'משתמש',
            role: 'admin' as const,
            avatar_url: session.user.user_metadata?.avatar_url || undefined,
            company_name: undefined,
            phone: undefined,
            worker_id: undefined,
            assigned_project_ids: [],
            created_at: new Date().toISOString(),
          }
          // Try to upsert the profile
          await supabase.from('profiles').upsert(fallback)
          setUser(fallback)
        }
        fetchStats(session.user.id)
        fetchAlerts(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await profiles.get(session.user.id)
          if (profile) {
            setUser(profile)
          } else {
            const fallback = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'משתמש',
              role: 'admin' as const,
              avatar_url: session.user.user_metadata?.avatar_url || undefined,
              company_name: undefined,
              phone: undefined,
              worker_id: undefined,
              assigned_project_ids: [],
              created_at: new Date().toISOString(),
            }
            await supabase.from('profiles').upsert(fallback)
            setUser(fallback)
          }
          fetchStats(session.user.id)
          fetchAlerts(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

// ─── useProjects hook with real-time sync ─────────────────────────

import { projects as projectsDb } from '../lib/supabase'
import { useAppStore as useStore } from '../store'

export function useProjects() {
  const { user } = useAuthStore()
  const { projects, projectsLoading, setProjects, setProjectsLoading } = useStore()

  useEffect(() => {
    if (!user) return
    setProjectsLoading(true)

    // Initial load
    projectsDb.list(user.id).then(({ data }) => {
      if (data) setProjects(data)
      setProjectsLoading(false)
    })

    // Real-time subscription
    const channel = projectsDb.subscribe(user.id, (updated) => {
      setProjects(updated)
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  return { projects, loading: projectsLoading }
}
