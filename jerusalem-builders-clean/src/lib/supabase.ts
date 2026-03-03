/// <reference types="vite/client" />
/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'
import type {
  Project, Invoice, Worker, Alert, Quote, WorkerTimeLog,
  PlanScan, UserProfile, DashboardStats, ApiResult
} from '../types'

// ─── Client ───────────────────────────────────────────────────────
// Set these in your .env file:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: {
    storageKey: 'jb-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

// ─── Auth ─────────────────────────────────────────────────────────

export const auth = {
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
      },
    })
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { data: null, error: error.message }
    // Create profile row
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
      })
    }
    return { data, error: null }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
  },

  getSession: () => supabase.auth.getSession(),

  onAuthChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
}

// ─── Profile ──────────────────────────────────────────────────────

export const profiles = {
  get: async (userId: string): Promise<ApiResult<UserProfile>> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error: error?.message ?? null }
  },

  update: async (userId: string, updates: Partial<UserProfile>): Promise<ApiResult<UserProfile>> => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },
}

// ─── Projects ─────────────────────────────────────────────────────

export const projects = {
  list: async (userId: string): Promise<ApiResult<Project[]>> => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data, error: error?.message ?? null }
  },

  get: async (id: string): Promise<ApiResult<Project>> => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error: error?.message ?? null }
  },

  create: async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResult<Project>> => {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },

  update: async (id: string, updates: Partial<Project>): Promise<ApiResult<Project>> => {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },

  delete: async (id: string): Promise<ApiResult<null>> => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    return { data: null, error: error?.message ?? null }
  },

  // Real-time subscription
  subscribe: (userId: string, cb: (projects: Project[]) => void) => {
    return supabase
      .channel('projects-' + userId + '-' + Date.now())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${userId}`,
      }, async () => {
        const { data } = await projects.list(userId)
        if (data) cb(data)
      })
      .subscribe()
  },
}

// ─── Invoices ─────────────────────────────────────────────────────

export const invoices = {
  list: async (userId: string, projectId?: string): Promise<ApiResult<Invoice[]>> => {
    let query = supabase
      .from('invoices')
      .select('*, project:projects(id, name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (projectId) query = query.eq('project_id', projectId)
    const { data, error } = await query
    return { data, error: error?.message ?? null }
  },

  create: async (invoice: Omit<Invoice, 'id' | 'created_at' | 'project'>): Promise<ApiResult<Invoice>> => {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select('*, project:projects(id, name)')
      .single()
    return { data, error: error?.message ?? null }
  },

  update: async (id: string, updates: Partial<Invoice>): Promise<ApiResult<Invoice>> => {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select('*, project:projects(id, name)')
      .single()
    return { data, error: error?.message ?? null }
  },

  // Upload invoice image then return public URL
  uploadImage: async (file: File, userId: string): Promise<ApiResult<string>> => {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('invoice-images')
      .upload(path, file, { upsert: false })
    if (error) return { data: null, error: error.message }
    const { data } = supabase.storage.from('invoice-images').getPublicUrl(path)
    return { data: data.publicUrl, error: null }
  },

  // Call Anthropic API to extract invoice data directly from file
  extractWithAI: async (imageUrl: string, file?: File): Promise<ApiResult<Partial<Invoice>>> => {
    try {
      let b64: string
      let mediaType: string

      if (file) {
        // Use file directly - no need for Supabase Storage
        b64 = await new Promise<string>((res) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.readAsDataURL(file)
        })
        mediaType = file.type || 'image/jpeg'
      } else {
        const resp = await fetch(imageUrl)
        const blob = await resp.blob()
        b64 = await new Promise<string>((res) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
        mediaType = blob.type || 'image/jpeg'
      }

      // For PDF files, use document type
      const isDoc = mediaType === 'application/pdf'
      const contentBlock = isDoc
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }

      const aiResp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: `Extract invoice data. Return ONLY valid JSON, no markdown:
{"supplier_name":"","invoice_number":"","invoice_date":"DD/MM/YYYY","description":"","subtotal":0,"tax":0,"total":0}
All number fields must be numbers (not strings). Estimate if unclear.`,
              },
            ],
          }],
        }),
      })

      const aiData = await aiResp.json()
      const text = aiData.content?.map((c: { text?: string }) => c.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return { data: { ...parsed, ai_extracted: true }, error: null }
    } catch (e) {
      return { data: null, error: 'שגיאה בחילוץ נתונים מ-AI' }
    }
  },
}

// ─── Workers ──────────────────────────────────────────────────────

export const workers = {
  list: async (userId: string): Promise<ApiResult<Worker[]>> => {
    const { data, error } = await supabase
      .from('workers')
      .select('*, current_project:projects(id, name)')
      .eq('user_id', userId)
      .order('name')
    return { data, error: error?.message ?? null }
  },

  create: async (worker: Omit<Worker, 'id' | 'created_at' | 'current_project'>): Promise<ApiResult<Worker>> => {
    const { data, error } = await supabase
      .from('workers')
      .insert(worker)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },

  update: async (id: string, updates: Partial<Worker>): Promise<ApiResult<Worker>> => {
    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },

  logTime: async (log: Omit<WorkerTimeLog, 'id'>): Promise<ApiResult<WorkerTimeLog>> => {
    const { data, error } = await supabase
      .from('worker_time_logs')
      .insert(log)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },
}

// ─── Alerts ───────────────────────────────────────────────────────

export const alertsDb = {
  list: async (userId: string, unreadOnly = false): Promise<ApiResult<Alert[]>> => {
    let query = supabase
      .from('alerts')
      .select('*, project:projects(id, name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (unreadOnly) query = query.eq('is_read', false)
    const { data, error } = await query
    return { data, error: error?.message ?? null }
  },

  markRead: async (id: string): Promise<ApiResult<null>> => {
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', id)
    return { data: null, error: error?.message ?? null }
  },

  markAllRead: async (userId: string): Promise<ApiResult<null>> => {
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('user_id', userId)
    return { data: null, error: error?.message ?? null }
  },
}

// ─── Quotes ───────────────────────────────────────────────────────

export const quotes = {
  list: async (userId: string): Promise<ApiResult<Quote[]>> => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data, error: error?.message ?? null }
  },

  create: async (quote: Omit<Quote, 'id' | 'created_at'>): Promise<ApiResult<Quote>> => {
    const { data, error } = await supabase
      .from('quotes')
      .insert(quote)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },

  update: async (id: string, updates: Partial<Quote>): Promise<ApiResult<Quote>> => {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  },
}

// ─── Dashboard Stats ──────────────────────────────────────────────

export const dashboard = {
  getStats: async (userId: string): Promise<ApiResult<DashboardStats>> => {
    // Fetch in parallel
    const [projRes, invRes, workRes, alertRes] = await Promise.all([
      supabase.from('projects').select('status, contract_value, actual_cost').eq('user_id', userId),
      supabase.from('invoices').select('total, status, created_at').eq('user_id', userId),
      supabase.from('workers').select('status').eq('user_id', userId),
      supabase.from('alerts').select('id').eq('user_id', userId).eq('is_read', false),
    ])

    const projectList = projRes.data ?? []
    const invoiceList = invRes.data ?? []
    const workerList = workRes.data ?? []

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const monthlyInvoices = invoiceList.filter(i => i.created_at >= monthStart)

    return {
      data: {
        active_projects: projectList.filter(p => p.status === 'active').length,
        delayed_projects: projectList.filter(p => p.status === 'delayed').length,
        monthly_revenue: monthlyInvoices.filter(i => i.status === 'approved').reduce((s, i) => s + i.total, 0),
        monthly_expenses: monthlyInvoices.reduce((s, i) => s + i.total, 0),
        workers_on_site: workerList.filter(w => w.status === 'on_site').length,
        pending_invoices: invoiceList.filter(i => i.status === 'pending').length,
        open_alerts: alertRes.data?.length ?? 0,
        total_contract_value: projectList.reduce((s, p) => s + (p.contract_value ?? 0), 0),
      },
      error: null,
    }
  },
}

// ─── Storage helpers ──────────────────────────────────────────────

export const storage = {
  uploadPlan: async (file: File, userId: string): Promise<ApiResult<string>> => {
    const ext = file.name.split('.').pop()
    const path = `${userId}/plans/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('plan-files').upload(path, file)
    if (error) return { data: null, error: error.message }
    const { data } = supabase.storage.from('plan-files').getPublicUrl(path)
    return { data: data.publicUrl, error: null }
  },
}
