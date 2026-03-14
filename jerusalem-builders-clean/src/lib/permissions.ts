// ═══════════════════════════════════════════════════════════════
// VISION PRO — מערכת הרשאות
// 3 רמות: admin | project_manager | field_worker
// ═══════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'project_manager' | 'field_worker' | 'client'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל ראשי',
  project_manager: 'מנהל פרויקט',
  field_worker: 'עובד שטח',
  client: 'לקוח',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#C9A84C',
  project_manager: '#4E7A9E',
  field_worker: '#5C9967',
  client: '#B87830',
}

// ─── Permissions Matrix ───────────────────────────────────────────

export interface Permissions {
  // Dashboard
  view_dashboard: boolean
  view_all_projects: boolean
  view_own_projects: boolean  // only their assigned projects

  // Projects
  create_project: boolean
  edit_project: boolean
  delete_project: boolean
  update_progress: boolean  // pm can update their projects

  // Workers / Team
  view_all_workers: boolean
  manage_workers: boolean
  log_own_hours: boolean    // field worker logs own hours
  approve_hours: boolean    // pm/admin approve time logs

  // Invoices
  view_invoices: boolean
  create_invoice: boolean
  approve_invoice: boolean
  view_financial_details: boolean

  // Quotes
  view_quotes: boolean
  create_quote: boolean
  approve_quote: boolean

  // Reports
  view_reports: boolean
  generate_reports: boolean
  export_reports: boolean

  // Scanner / BOQ
  use_scanner: boolean
  view_boq: boolean

  // Cashflow
  view_cashflow: boolean

  // Admin
  manage_users: boolean
  manage_roles: boolean
  view_all_financials: boolean

  // Client portal
  is_client: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  // ── מנהל ראשי — הכל ─────────────────────────────────────────
  admin: {
    view_dashboard: true,
    view_all_projects: true,
    view_own_projects: true,
    create_project: true,
    edit_project: true,
    delete_project: true,
    update_progress: true,
    view_all_workers: true,
    manage_workers: true,
    log_own_hours: true,
    approve_hours: true,
    view_invoices: true,
    create_invoice: true,
    approve_invoice: true,
    view_financial_details: true,
    view_quotes: true,
    create_quote: true,
    approve_quote: true,
    view_reports: true,
    generate_reports: true,
    export_reports: true,
    use_scanner: true,
    view_boq: true,
    view_cashflow: true,
    manage_users: true,
    manage_roles: true,
    view_all_financials: true,
    is_client: false,
  },

  // ── מנהל פרויקט — פרויקטים שלו + עובדים + חשבוניות ─────────
  project_manager: {
    view_dashboard: true,
    view_all_projects: false,
    view_own_projects: true,
    create_project: false,
    edit_project: true,       // only own projects
    delete_project: false,
    update_progress: true,
    view_all_workers: true,
    manage_workers: true,     // only own site workers
    log_own_hours: true,
    approve_hours: true,      // approve team's hours
    view_invoices: true,
    create_invoice: true,
    approve_invoice: true,    // own project invoices
    view_financial_details: true,
    view_quotes: true,
    create_quote: false,
    approve_quote: false,
    view_reports: true,
    generate_reports: true,   // own projects only
    export_reports: true,
    use_scanner: true,
    view_boq: true,
    view_cashflow: false,     // no full cashflow
    manage_users: false,
    manage_roles: false,
    view_all_financials: false,
    is_client: false,
  },

  // ── עובד שטח — מינימלי ───────────────────────────────────────
  field_worker: {
    view_dashboard: false,
    view_all_projects: false,
    view_own_projects: true,   // only their site
    create_project: false,
    edit_project: false,
    delete_project: false,
    update_progress: false,
    view_all_workers: false,
    manage_workers: false,
    log_own_hours: true,       // CORE function
    approve_hours: false,
    view_invoices: false,
    create_invoice: false,
    approve_invoice: false,
    view_financial_details: false,
    view_quotes: false,
    create_quote: false,
    approve_quote: false,
    view_reports: false,
    generate_reports: false,
    export_reports: false,
    use_scanner: false,
    view_boq: false,
    view_cashflow: false,
    manage_users: false,
    manage_roles: false,
    view_all_financials: false,
    is_client: false,
  },

  // ── לקוח — פורטל בלבד ─────────────────────────────────────────
  client: {
    view_dashboard: false,
    view_all_projects: false,
    view_own_projects: true,
    create_project: false,
    edit_project: false,
    delete_project: false,
    update_progress: false,
    view_all_workers: false,
    manage_workers: false,
    log_own_hours: false,
    approve_hours: false,
    view_invoices: false,
    create_invoice: false,
    approve_invoice: false,
    view_financial_details: false,
    view_quotes: true,         // see their quote
    create_quote: false,
    approve_quote: false,
    view_reports: false,
    generate_reports: false,
    export_reports: false,
    use_scanner: false,
    view_boq: false,
    view_cashflow: false,
    manage_users: false,
    manage_roles: false,
    view_all_financials: false,
    is_client: true,
  },
}

// ─── Permission Check Hook ────────────────────────────────────────

import { useAuthStore } from '../store'

export function usePermissions() {
  const { user } = useAuthStore()
  const rawRole = (user as any)?.role
  const role: UserRole = rawRole && rawRole in ROLE_PERMISSIONS ? rawRole as UserRole : 'project_manager'
  const perms = ROLE_PERMISSIONS[role]

  const can = (permission: keyof Permissions): boolean => {
    return perms[permission] as boolean ?? false
  }

  return { role, perms, can }
}

// NAV items filtered by role
export const NAV_BY_ROLE: Record<UserRole, string[]> = {
  admin: ['dashboard', 'projects', 'team', 'invoices', 'quotes', 'cashflow', 'scanner', 'reports', 'users'],
  project_manager: ['dashboard', 'projects', 'team', 'invoices', 'scanner', 'reports'],
  field_worker: ['timelog', 'myproject'],
  client: ['client_dashboard'],
}
