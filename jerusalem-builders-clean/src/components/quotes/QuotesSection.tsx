import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store'
import { quotes as quotesDb } from '../../lib/supabase'
import type { Quote } from '../../types'
import toast from 'react-hot-toast'

const STATUS_HE: Record<Quote['status'], string> = {
  draft: 'טיוטה', sent: 'נשלחה', accepted: 'אושר', rejected: 'נדחה', expired: 'פגה'
}
const STATUS_COLOR: Record<Quote['status'], string> = {
  draft: '#7A756E', sent: '#4E7A9E', accepted: '#5C9967', rejected: '#A85050', expired: '#A09890'
}

const WORK_TYPES = ['שיפוץ פנים מלא', 'ריצוף ואריחים', 'מטבח ואמבטיה', 'בניה מהשלד', 'גמרים ועיצוב', 'חשמל ואינסטלציה', 'גבס ותקרות']

export default function QuotesSection() {
  const { user } = useAuthStore()
  const [quoteList, setQuoteList] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'list'>('list')
  const [form, setForm] = useState({
    client_name: '', project_name: '', area_sqm: '',
    work_type: WORK_TYPES[0], description: '', amount: '', valid_days: '30',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    quotesDb.list(user.id).then(({ data }) => { setQuoteList(data ?? []); setLoading(false) })
  }, [user?.id])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await quotesDb.create({
      user_id: user!.id,
      client_name: form.client_name,
      project_name: form.project_name,
      area_sqm: Number(form.area_sqm),
      work_type: form.work_type,
      description: form.description,
      amount: Number(form.amount),
      valid_days: Number(form.valid_days),
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    if (data) {
      setQuoteList(prev => [data, ...prev])
      setForm({ client_name: '', project_name: '', area_sqm: '', work_type: WORK_TYPES[0], description: '', amount: '', valid_days: '30' })
      setTab('list')
      toast.success('הצעת מחיר נשלחה!')
    }
  }

  const totalAccepted = quoteList.filter(q => q.status === 'accepted').reduce((s, q) => s + q.amount, 0)
  const totalPending = quoteList.filter(q => q.status === 'sent').reduce((s, q) => s + q.amount, 0)
  const winRate = quoteList.length > 0 ? Math.round((quoteList.filter(q => q.status === 'accepted').length / quoteList.filter(q => q.status !== 'draft').length) * 100) : 0

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>הצעות מחיר</div>
          <div style={S.sub}>יצירה מהירה · מעקב · סגירת עסקאות</div>
        </div>
        <button style={S.btnGold} onClick={() => setTab('new')}>+ הצעה חדשה</button>
      </div>

      <div style={S.kpiRow}>
        {[
          { label: 'אושרו', val: `₪${(totalAccepted / 1000).toFixed(0)}K`, color: '#5C9967' },
          { label: 'ממתינות', val: `₪${(totalPending / 1000).toFixed(0)}K`, color: '#4E7A9E' },
          { label: 'סה"כ הצעות', val: quoteList.length, color: '#C9A84C' },
          { label: 'אחוז סגירה', val: `${winRate}%`, color: winRate > 50 ? '#5C9967' : '#B87830' },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLbl}>{k.label}</div>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: 0 }}>
        {([['list', 'הצעות קיימות'], ['new', '+ הצעה חדשה']] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 16px', background: 'none', border: 'none',
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: tab === id ? '#C9A84C' : '#7A756E',
            borderBottom: `2px solid ${tab === id ? '#C9A84C' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
          }}>{lbl}</button>
        ))}
      </div>

      {/* Quote form */}
      {tab === 'new' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none', padding: 24 }}>
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FField label="שם לקוח *" value={form.client_name} onChange={v => set('client_name', v)} placeholder="משפחת כהן" required />
              <FField label="שם פרויקט" value={form.project_name} onChange={v => set('project_name', v)} placeholder="קיסריה — וילה חדשה" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FField label='שטח (מ"ר)' value={form.area_sqm} onChange={v => set('area_sqm', v)} type="number" placeholder="650" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={S.fLbl}>סוג עבודה</label>
                <select value={form.work_type} onChange={e => set('work_type', e.target.value)} style={S.fInp as React.CSSProperties}>
                  {WORK_TYPES.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={S.fLbl}>פירוט עבודות</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                placeholder="ריצוף שיש קררה, גבס, צבע פרימיום, חשמל, אינסטלציה..."
                style={{ ...S.fInp as React.CSSProperties, resize: 'none', height: 80 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <FField label="סכום הצעה (₪) *" value={form.amount} onChange={v => set('amount', v)} type="number" placeholder="1,200,000" required />
              <FField label="תוקף (ימים)" value={form.valid_days} onChange={v => set('valid_days', v)} type="number" />
            </div>
            {form.amount && form.area_sqm && (
              <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 11, color: '#7A756E' }}>
                מחיר למ"ר: <strong style={{ color: '#C9A84C' }}>₪{Math.round(Number(form.amount) / Number(form.area_sqm)).toLocaleString()}</strong>
                <span style={{ marginRight: 16 }}>סה"כ: <strong style={{ color: '#C9A84C', fontFamily: 'serif', fontSize: 14 }}>₪{Number(form.amount).toLocaleString()}</strong></span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setTab('list')} style={{ ...S.btnOutline, flex: 1 }}>ביטול</button>
              <button type="submit" disabled={saving} style={{ ...S.btnGold, flex: 3, padding: 11 }}>
                {saving ? 'שולח...' : '⚡ צור ושלח הצעה'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quote list */}
      {tab === 'list' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
          {loading && <div style={{ padding: 24, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>טוען...</div>}
          {!loading && quoteList.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', color: '#7A756E', fontSize: 12 }}>
              אין הצעות מחיר עדיין —{' '}
              <span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => setTab('new')}>צור הצעה ראשונה</span>
            </div>
          )}
          {quoteList.map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', transition: '.15s' }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.02)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#1A1714', fontWeight: 400 }}>{q.client_name}</div>
                <div style={{ fontSize: 10, color: '#7A756E', marginTop: 2 }}>
                  {q.project_name || q.work_type}
                  {q.area_sqm > 0 && ` · ${q.area_sqm} מ"ר`}
                </div>
                {q.sent_at && (
                  <div style={{ fontSize: 9, color: '#A09890', marginTop: 2 }}>
                    נשלחה {new Date(q.sent_at).toLocaleDateString('he-IL')} · תוקף {q.valid_days} יום
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'serif', fontSize: 18, color: '#C9A84C' }}>₪{q.amount.toLocaleString()}</div>
                {q.area_sqm > 0 && <div style={{ fontSize: 9, color: '#7A756E' }}>₪{Math.round(q.amount / q.area_sqm).toLocaleString()} למ"ר</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: 8, letterSpacing: 1.5, padding: '3px 8px', textTransform: 'uppercase',
                  color: STATUS_COLOR[q.status], border: `1px solid ${STATUS_COLOR[q.status]}40`,
                  background: `${STATUS_COLOR[q.status]}15`,
                }}>
                  {STATUS_HE[q.status]}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {q.status === 'sent' && (
                    <>
                      <button onClick={async () => {
                        const { data } = await quotesDb.update(q.id, { status: 'accepted' })
                        if (data) { setQuoteList(prev => prev.map(p => p.id === q.id ? data : p)); toast.success('הצעה אושרה!') }
                      }} style={{ ...S.btnMini, color: '#5C9967', borderColor: 'rgba(92,153,103,0.3)' }}>✓ אושר</button>
                      <button onClick={async () => {
                        const { data } = await quotesDb.update(q.id, { status: 'rejected' })
                        if (data) setQuoteList(prev => prev.map(p => p.id === q.id ? data : p))
                      }} style={{ ...S.btnMini, color: '#A85050', borderColor: 'rgba(168,80,80,0.3)' }}>✕ נדחה</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FField({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={S.fLbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={S.fInp as React.CSSProperties}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.15)'}
      />
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 0 } as React.CSSProperties,
  kpi: { background: '#FFFFFF', padding: '14px 16px' } as React.CSSProperties,
  kpiLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 7 },
  kpiVal: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  btnGold: { padding: '9px 18px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 14px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnMini: { padding: '3px 8px', background: 'none', border: '1px solid', fontSize: 8, letterSpacing: 1, cursor: 'pointer', fontFamily: 'inherit' },
  fLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E' },
  fInp: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%', transition: '.2s' },
}
