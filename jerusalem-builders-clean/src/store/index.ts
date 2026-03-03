import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, Project, Alert, DashboardStats } from '../types'
import { auth, dashboard, alertsDb, projects as projectsDb } from '../lib/supabase'

// ─── Auth Store ────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null
  loading: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
      signOut: async () => {
        await auth.signOut()
        set({ user: null })
      },
    }),
    { name: 'jbuilders-auth', partialize: (s) => ({ user: s.user }) }
  )
)

// ─── App Store ────────────────────────────────────────────────────

interface AppState {
  // Navigation
  activeSection: string
  setActiveSection: (s: string) => void

  // Projects
  projects: Project[]
  projectsLoading: boolean
  setProjects: (p: Project[]) => void
  setProjectsLoading: (v: boolean) => void
  addProject: (p: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  removeProject: (id: string) => void

  // Dashboard stats
  stats: DashboardStats | null
  statsLoading: boolean
  fetchStats: (userId: string) => Promise<void>

  // Alerts
  alerts: Alert[]
  alertsLoading: boolean
  fetchAlerts: (userId: string) => Promise<void>
  markAlertRead: (id: string) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>()((set, get) => ({
  activeSection: 'dashboard',
  setActiveSection: (activeSection) => set({ activeSection }),

  projects: [],
  projectsLoading: false,
  setProjects: (projects) => set({ projects }),
  setProjectsLoading: (projectsLoading) => set({ projectsLoading }),
  addProject: (p) => set((s) => ({ projects: [p, ...s.projects] })),
  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  stats: null,
  statsLoading: false,
  fetchStats: async (userId) => {
    set({ statsLoading: true })
    const { data } = await dashboard.getStats(userId)
    set({ stats: data, statsLoading: false })
  },

  alerts: [],
  alertsLoading: false,
  fetchAlerts: async (userId) => {
    set({ alertsLoading: true })
    const { data } = await alertsDb.list(userId)
    set({ alerts: data ?? [], alertsLoading: false })
  },
  markAlertRead: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)),
    })),

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))

// ─── Hooks ────────────────────────────────────────────────────────

export const useUnreadAlerts = () => {
  const alerts = useAppStore((s) => s.alerts)
  return alerts.filter((a) => !a.is_read)
}

export const useProjectById = (id: string) => {
  const projects = useAppStore((s) => s.projects)
  return projects.find((p) => p.id === id)
}
