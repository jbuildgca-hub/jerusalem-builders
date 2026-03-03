// ─── Core Types ───────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'delayed' | 'on_hold' | 'completed' | 'bid'

export interface Project {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  name: string
  address: string
  client_name: string
  client_email?: string
  client_phone?: string
  area_sqm: number
  work_type: string
  contract_value: number
  actual_cost: number
  progress_pct: number
  status: ProjectStatus
  start_date: string
  end_date: string
  notes?: string
}

export type InvoiceStatus = 'pending' | 'approved' | 'rejected'

export interface Invoice {
  id: string
  created_at: string
  user_id: string
  project_id?: string
  supplier_name: string
  invoice_number: string
  invoice_date: string
  description: string
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  image_url?: string
  ai_extracted: boolean
  project?: Pick<Project, 'id' | 'name'>
}

export type WorkerStatus = 'on_site' | 'off_site' | 'unavailable'

export interface Worker {
  id: string
  created_at: string
  user_id: string
  name: string
  role: string
  hourly_rate: number
  phone?: string
  status: WorkerStatus
  current_project_id?: string
  hours_this_month: number
  current_project?: Pick<Project, 'id' | 'name'>
}

export interface WorkerTimeLog {
  id: string
  worker_id: string
  project_id: string
  date: string
  hours: number
  notes?: string
}

export interface Alert {
  id: string
  created_at: string
  user_id: string
  project_id?: string
  type: 'budget_overrun' | 'delay' | 'invoice_pending' | 'worker' | 'material'
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  is_read: boolean
  project?: Pick<Project, 'id' | 'name'>
}

export interface Quote {
  id: string
  created_at: string
  user_id: string
  client_name: string
  project_name: string
  area_sqm: number
  work_type: string
  description: string
  amount: number
  valid_days: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  sent_at?: string
}

export interface PlanScan {
  id: string
  created_at: string
  user_id: string
  project_id?: string
  file_url: string
  file_name: string
  total_area_sqm?: number
  rooms?: Room[]
  boq_items?: BOQItem[]
  status: 'processing' | 'done' | 'failed'
}

export interface Room {
  name: string
  area_sqm: number
}

export interface BOQItem {
  category: string
  item: string
  quantity: number
  unit: string
  unit_price: number
  total: number
}

// ─── Auth ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string
  company_name?: string
  phone?: string
  avatar_url?: string
  created_at: string
}

// ─── Dashboard Stats ──────────────────────────────────────────────

export interface DashboardStats {
  active_projects: number
  delayed_projects: number
  monthly_revenue: number
  monthly_expenses: number
  workers_on_site: number
  pending_invoices: number
  open_alerts: number
  total_contract_value: number
}

export interface CashflowMonth {
  month: string
  income: number
  expenses: number
}

// ─── API response wrapper ─────────────────────────────────────────

export interface ApiResult<T> {
  data: T | null
  error: string | null
}
