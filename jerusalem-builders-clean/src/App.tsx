import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAuthStore, useAppStore, useUnreadAlerts } from './store'
import { LOGO_DATA } from './lib/logo'
import AuthPage from './components/auth/AuthPage'
import ProjectsSection from './components/projects/ProjectsSection'
import InvoicesSection from './components/invoices/InvoicesSection'
import TeamSection from './components/team/TeamSection'
import CashflowSection from './components/cashflow/CashflowSection'
import ReportsSection from './components/reports/ReportsSection'
import QuotesSection from './components/quotes/QuotesSection'
import UsersSection from './components/admin/UsersSection'
import FieldWorkerApp from './components/admin/FieldWorkerApp'
import ScannerSection from './components/scanner/ScannerSection'
import { usePermissions, ROLE_LABELS, ROLE_COLORS, type UserRole } from './lib/permissions'
import { Toaster } from 'react-hot-toast'

function DashboardSection() {
  const { stats, projects, alerts, fetchStats } = useAppStore()
  const { user } = useAuthStore()
  useEffect(() => { if (user) fetchStats(user.id) }, [user?.id])
  const recentAlerts = alerts.slice(0, 5)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' }}>דשבורד ראשי</div>
          <div style={{ fontSize: 11, color: '#7A756E', marginTop: 3 }}>{new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 20 }}>
        {[
          { label: 'פרויקטים פעילים', val: stats?.active_projects ?? '—', color: '#C9A84C' },
          { label: 'מחזור החודש', val: stats ? `₪${(stats.monthly_revenue / 1000).toFixed(0)}K` : '—', color: '#1A1714' },
          { label: 'עובדים באתרים', val: stats?.workers_on_site ?? '—', color: '#5C9967' },
          { label: 'חשבוניות פתוחות', val: stats?.pending_invoices ?? '—', color: '#A85050' },
          { label: 'התראות פתוחות', val: stats?.open_alerts ?? '—', color: '#B87830' },
        ].map(k => (
          <div key={k.label} style={{ background: '#FFFFFF', padding: '16px 18px' }}>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'serif', fontSize: 28, fontWeight: 300, lineHeight: 1, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 0 }}>
          <div style={{ fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', padding: '14px 16px 0', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>פרויקטים אחרונים</span>
            <button onClick={() => useAppStore.getState().setActiveSection('projects')} style={{ background: 'none', border: 'none', color: '#7A756E', fontSize: 9, letterSpacing: 1, cursor: 'pointer', fontFamily: 'inherit' }}>הצג הכל →</button>
          </div>
          {projects.slice(0, 5).map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: p.status === 'active' ? '#5C9967' : p.status === 'delayed' ? '#A85050' : '#B87830' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#1A1714' }}>{p.name}</div>
                <div style={{ fontSize: 9, color: '#7A756E' }}>{p.client_name}</div>
              </div>
              <div style={{ fontFamily: 'serif', fontSize: 15, color: '#C9A84C' }}>{p.progress_pct}%</div>
              <div style={{ width: 60, height: 2, background: '#D8D4CE', borderRadius: 1 }}>
                <div style={{ height: '100%', width: `${p.progress_pct}%`, background: '#C9A84C', borderRadius: 1 }} />
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#7A756E', fontSize: 11 }}>
              אין פרויקטים עדיין — <span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => useAppStore.getState().setActiveSection('projects')}>צור פרויקט ראשון</span>
            </div>
          )}
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 0 }}>
          <div style={{ fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', padding: '14px 16px 10px' }}>
            התראות {recentAlerts.filter(a => !a.is_read).length > 0 && <span style={{ color: '#A85050' }}>● {recentAlerts.filter(a => !a.is_read).length}</span>}
          </div>
          {recentAlerts.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#7A756E', fontSize: 11 }}>אין התראות פתוחות ✓</div>
          )}
          {recentAlerts.map(a => (
            <div key={a.id} style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: '#1A1714' }}>{a.title}</div>
              <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>{a.project?.name} · {new Date(a.created_at).toLocaleDateString('he-IL')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const ALL_NAV = [
  { id: 'dashboard', icon: '◈', label: 'דשבורד', group: 'ניהול', roles: ['admin', 'project_manager'] },
  { id: 'projects', icon: '◻', label: 'פרויקטים', group: 'ניהול', roles: ['admin', 'project_manager'] },
  { id: 'team', icon: '◉', label: 'צוות', group: 'ניהול', roles: ['admin', 'project_manager'] },
  { id: 'invoices', icon: '◈', label: 'חשבוניות AI', group: 'פיננסי', roles: ['admin', 'project_manager'] },
  { id: 'quotes', icon: '◎', label: 'הצעות מחיר', group: 'פיננסי', roles: ['admin'] },
  { id: 'cashflow', icon: '◈', label: 'תזרים', group: 'פיננסי', roles: ['admin'] },
  { id: 'scanner', icon: '⊞', label: 'סריקת תוכנית', group: 'כלים', roles: ['admin', 'project_manager'] },
  { id: 'reports', icon: '▦', label: 'דוחות', group: 'כלים', roles: ['admin', 'project_manager'] },
  { id: 'users', icon: '⊙', label: 'משתמשים', group: 'מערכת', roles: ['admin'] },
]

function AppShell() {
  const { user, signOut } = useAuthStore()
  const { activeSection, setActiveSection } = useAppStore()
  const unread = useUnreadAlerts()
  const { role, can } = usePermissions()

  if (role === 'field_worker') return <FieldWorkerApp />

  const NAV = ALL_NAV.filter(n => n.roles.includes(role))
  const groups = [...new Set(NAV.map(n => n.group))]

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return can('view_dashboard') ? <DashboardSection /> : null
      case 'projects': return <ProjectsSection />
      case 'invoices': return can('view_invoices') ? <InvoicesSection /> : null
      case 'team': return can('view_all_workers') ? <TeamSection /> : null
      case 'quotes': return can('view_quotes') ? <QuotesSection /> : null
      case 'cashflow': return can('view_cashflow') ? <CashflowSection /> : null
      case 'scanner': return can('use_scanner') ? <ScannerSection /> : null
      case 'reports': return can('view_reports') ? <ReportsSection /> : null
      case 'users': return can('manage_users') ? <UsersSection /> : null
      default: return <DashboardSection />
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gridTemplateRows: '52px 1fr', height: '100vh', fontFamily: "'Heebo', sans-serif", direction: 'rtl' }}>
      <div style={{ gridColumn: '1/-1', background: '#FFFFFF', borderBottom: '1px solid rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 0 }}>
        <div style={{ width: 200, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid rgba(201,168,76,0.12)', height: '100%' }}>
          <img src={LOGO_DATA} alt="Jerusalem Builders" style={{ height: 36, width: 'auto' }} />
        </div>
        <div style={{ flex: 1, padding: '0 24px' }}>
          <input placeholder="חיפוש — פרויקט, עובד, חשבונית..." style={{ background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.12)', color: '#1A1714', padding: '7px 14px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 280 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 24 }}>
          <div style={{ fontSize: 11, color: '#7A756E' }}>{new Date().toLocaleDateString('he-IL')}</div>
          <div style={{ position: 'relative' }}>
            <button style={{ background: 'none', border: '1px solid rgba(201,168,76,0.12)', color: '#7A756E', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔔</button>
            {unread.length > 0 && <div style={{ position: 'absolute', top: 5, left: 5, width: 7, height: 7, borderRadius: '50%', background: '#C9A84C' }} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8E5E0', border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontSize: 13, color: '#C9A84C', overflow: 'hidden' }}>
              {(user as any)?.avatar_url
                ? <img src={(user as any).avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user?.full_name?.[0] ?? 'א'}
            </div>
            <div style={{ fontSize: 11, color: '#1A1714' }}>{user?.full_name}</div>
            <button onClick={signOut} style={{ background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#A85050', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 10px' }}>יציאה</button>
          </div>
          <div style={{ fontSize: 7, letterSpacing: 2, padding: '3px 9px', textTransform: 'uppercase', color: ROLE_COLORS[role as UserRole] ?? '#7A756E', border: `1px solid ${ROLE_COLORS[role as UserRole] ?? '#7A756E'}40`, background: `${ROLE_COLORS[role as UserRole] ?? '#7A756E'}12` }}>
            {ROLE_LABELS[role as UserRole] ?? role}
          </div>
        </div>
      </div>
      <nav style={{ background: '#FFFFFF', borderLeft: '1px solid rgba(201,168,76,0.12)', padding: '8px 0', overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 7, letterSpacing: 4, color: '#A09890', textTransform: 'uppercase', padding: '10px 18px 4px' }}>{group}</div>
            {NAV.filter(n => n.group === group).map(n => (
              <div key={n.id} onClick={() => setActiveSection(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px',
                fontSize: 11, letterSpacing: .5, cursor: 'pointer', transition: '.15s',
                color: activeSection === n.id ? '#C9A84C' : '#7A756E',
                borderRight: `2px solid ${activeSection === n.id ? '#C9A84C' : 'transparent'}`,
                background: activeSection === n.id ? 'rgba(201,168,76,0.04)' : 'transparent',
              }}>
                <span style={{ fontSize: 12, width: 16, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>
      <main style={{ overflow: 'auto', background: '#F5F3EF' }}>
        <div style={{ padding: '20px 24px', minHeight: '100%' }}>
          {renderSection()}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <img src={LOGO_DATA} alt="Jerusalem Builders" style={{ width: 160, height: 'auto' }} />
        <div style={{ fontSize: 11, color: '#7A756E', letterSpacing: 2 }}>טוען...</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '6px 16px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>
          לחץ לרענון
        </button>
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#FFFFFF', color: '#1A1714', border: '1px solid rgba(201,168,76,0.2)', fontFamily: 'Heebo, sans-serif', fontSize: 12 },
          success: { iconTheme: { primary: '#5C9967', secondary: '#F5F3EF' } },
          error: { iconTheme: { primary: '#A85050', secondary: '#F5F3EF' } },
        }}
      />
      {user ? <AppShell /> : <AuthPage />}
    </>
  )
}
