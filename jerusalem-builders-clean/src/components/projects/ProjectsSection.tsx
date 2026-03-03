import { useState } from 'react'
import { useAuthStore, useAppStore } from '../../store'
import { projects as projectsDb } from '../../lib/supabase'
import type { Project, ProjectStatus } from '../../types'
import toast from 'react-hot-toast'
import GoogleDriveExport from '../reports/GoogleDriveExport'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'פעיל', delayed: 'עיכוב', on_hold: 'עצור', completed: 'הושלם', bid: 'הצעה'
}
const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: '#5C9967', delayed: '#A85050', on_hold: '#B87830', completed: '#4E7A9E', bid: '#6A6A8A'
}

export default function ProjectsSection() {
  const { user } = useAuthStore()
  const { projects, addProject, updateProject } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)

  const totalValue = projects.reduce((s, p) => s + p.contract_value, 0)
  const totalCost = projects.reduce((s, p) => s + p.actual_cost, 0)

  return (
    <div>
      {/* Header */}
      <div style={styles.ph}>
        <div>
          <div style={styles.title}>פרויקטים</div>
          <div style={styles.sub}>{projects.length} פרויקטים · ₪{(totalValue / 1_000_000).toFixed(1)}M מחזור כולל</div>
        </div>
        <button style={styles.btnGold} onClick={() => setShowModal(true)}>+ פרויקט חדש</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 20 }}>
        {[
          { label: 'פעילים', val: projects.filter(p => p.status === 'active').length, color: '#5C9967' },
          { label: 'בעיכוב', val: projects.filter(p => p.status === 'delayed').length, color: '#A85050' },
          { label: 'עצורים', val: projects.filter(p => p.status === 'on_hold').length, color: '#B87830' },
          { label: 'ממוצע התקדמות', val: projects.length ? Math.round(projects.reduce((s, p) => s + p.progress_pct, 0) / projects.length) + '%' : '—', color: '#C9A84C' },
        ].map(k => (
          <div key={k.label} style={styles.kpi}>
            <div style={styles.kpiLabel}>{k.label}</div>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: 0 }}>
        {(['all', 'active', 'delayed', 'on_hold', 'bid', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', background: 'none', border: 'none',
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: filter === f ? '#C9A84C' : '#7A756E',
            borderBottom: `2px solid ${filter === f ? '#C9A84C' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1, transition: '.15s',
          }}>
            {f === 'all' ? 'הכל' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '10px 1fr 90px 110px 90px 80px 80px 28px', gap: 10, padding: '7px 16px', fontSize: 7, letterSpacing: 3, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
          <div /><div>פרויקט</div><div>ערך</div><div>התקדמות</div><div>עלות</div><div>סטטוס</div><div>סיום</div><div />
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#7A756E', fontSize: 12 }}>
            אין פרויקטים {filter !== 'all' ? `בסטטוס "${STATUS_LABELS[filter]}"` : '— צור פרויקט ראשון'}
          </div>
        )}
        {filtered.map(p => <ProjectRow key={p.id} project={p} onUpdate={(u) => updateProject(p.id, u)} />)}
      </div>

      {/* Modal */}
      {showModal && (
        <CreateProjectModal
          userId={user!.id}
          onClose={() => setShowModal(false)}
          onCreate={addProject}
        />
      )}
    </div>
  )
}

function ProjectRow({ project: p, onUpdate }: { project: Project; onUpdate: (u: Partial<Project>) => void }) {
  const statusColor = STATUS_COLORS[p.status]
  const isDelayed = p.status === 'delayed'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '10px 1fr 90px 110px 90px 80px 80px 28px',
      gap: 10, alignItems: 'center', padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      cursor: 'pointer', transition: '.15s',
    }}
      onMouseOver={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, boxShadow: p.status === 'active' ? `0 0 5px ${statusColor}80` : 'none' }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 400, color: '#1A1714' }}>{p.name}</div>
        <div style={{ fontSize: 9, color: '#7A756E', marginTop: 1 }}>{p.address} · {p.client_name}</div>
      </div>
      <div style={{ fontSize: 11, textAlign: 'center', color: '#1A1714' }}>₪{(p.contract_value / 1000).toFixed(0)}K</div>
      <div>
        <div style={{ fontFamily: 'serif', fontSize: 15, color: '#C9A84C', textAlign: 'center' }}>{p.progress_pct}%</div>
        <div style={{ height: 2, background: '#D8D4CE', borderRadius: 1, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ height: '100%', width: `${p.progress_pct}%`, background: 'linear-gradient(90deg, #C9A84C, #E8D5A3)', borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ fontSize: 11, textAlign: 'center', color: p.actual_cost > p.contract_value * 0.95 ? '#A85050' : '#1A1714' }}>
        ₪{(p.actual_cost / 1000).toFixed(0)}K
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '3px 7px', color: statusColor,
          border: `1px solid ${statusColor}40`, background: `${statusColor}18`,
        }}>{STATUS_LABELS[p.status]}</span>
      </div>
      <div style={{ fontSize: 9, color: isDelayed ? '#A85050' : '#7A756E', textAlign: 'center' }}>
        {new Date(p.end_date).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })}
      </div>
      <button style={{ background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', width: 22, height: 22, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
    </div>
  )
}

function CreateProjectModal({ userId, onClose, onCreate }: {
  userId: string; onClose: () => void; onCreate: (p: Project) => void
}) {
  const [form, setForm] = useState({
    name: '', address: '', client_name: '', client_email: '', client_phone: '',
    area_sqm: '', work_type: 'שיפוץ פנים מלא', contract_value: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '', notes: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await projectsDb.create({
      user_id: userId,
      name: form.name,
      address: form.address,
      client_name: form.client_name,
      client_email: form.client_email,
      client_phone: form.client_phone,
      area_sqm: Number(form.area_sqm),
      work_type: form.work_type,
      contract_value: Number(form.contract_value),
      actual_cost: 0,
      progress_pct: 0,
      status: 'active',
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes,
    })
    setLoading(false)
    if (error) { toast.error(error); return }
    if (data) { onCreate(data); toast.success('פרויקט נוצר!'); onClose() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.2)', padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontFamily: 'serif', color: '#1A1714' }}>פרויקט חדש</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7A756E', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row>
            <MField label="שם פרויקט *" value={form.name} onChange={v => set('name', v)} required />
            <MField label="כתובת" value={form.address} onChange={v => set('address', v)} />
          </Row>
          <Row>
            <MField label="שם לקוח *" value={form.client_name} onChange={v => set('client_name', v)} required />
            <MField label="טלפון לקוח" value={form.client_phone} onChange={v => set('client_phone', v)} />
          </Row>
          <Row>
            <MField label="שטח (מ״ר) *" value={form.area_sqm} onChange={v => set('area_sqm', v)} type="number" required />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={styles.fLabel}>סוג עבודה</label>
              <select value={form.work_type} onChange={e => set('work_type', e.target.value)} style={styles.fInput as React.CSSProperties}>
                {['שיפוץ פנים מלא','ריצוף ואריחים','מטבח ואמבטיה','בניה מהשלד','גמרים','עיצוב פנים'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </Row>
          <MField label="ערך חוזה (₪) *" value={form.contract_value} onChange={v => set('contract_value', v)} type="number" required />
          <Row>
            <MField label="תאריך התחלה" value={form.start_date} onChange={v => set('start_date', v)} type="date" />
            <MField label="תאריך סיום *" value={form.end_date} onChange={v => set('end_date', v)} type="date" required />
          </Row>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={styles.fLabel}>הערות</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ ...styles.fInput as React.CSSProperties, resize: 'none', height: 60 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ ...styles.btnOutline, flex: 1 }}>ביטול</button>
            <button type="submit" disabled={loading} style={{ ...styles.btnGold, flex: 2, opacity: loading ? .7 : 1 }}>
              {loading ? 'יוצר...' : 'צור פרויקט'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

function MField({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={styles.fLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        style={styles.fInput as React.CSSProperties}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.15)'}
      />
    </div>
  )
}

const styles = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  kpi: { background: '#FFFFFF', padding: '16px 18px' } as React.CSSProperties,
  kpiLabel: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 8 },
  kpiVal: { fontFamily: 'serif', fontSize: 28, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  btnGold: { padding: '9px 20px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 20px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  fLabel: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E' },
  fInput: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%' },
}
