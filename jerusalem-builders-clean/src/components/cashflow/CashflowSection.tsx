import { useState, useEffect } from 'react'
import { useAuthStore, useAppStore } from '../../store'
import { supabase } from '../../lib/supabase'
import type { Invoice } from '../../types'

interface MonthData { month: string; label: string; income: number; expenses: number }

export default function CashflowSection() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<6 | 12>(12)

  useEffect(() => {
    if (!user) return
    supabase
      .from('invoices')
      .select('*, project:projects(id,name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setInvoices(data ?? []); setLoading(false) })
  }, [user?.id])

  // Build monthly cashflow from invoices
  const monthlyData: MonthData[] = Array.from({ length: period }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (period - 1 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('he-IL', { month: 'short' })
    const monthInvoices = invoices.filter(inv => inv.created_at?.startsWith(key))
    return {
      month: key, label,
      income: monthInvoices.filter(i => i.status === 'approved').reduce((s, i) => s + i.total, 0),
      expenses: monthInvoices.reduce((s, i) => s + i.total, 0),
    }
  })

  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses)), 1)
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0)
  const grossProfit = totalIncome - totalExpenses
  const margin = totalIncome > 0 ? ((grossProfit / totalIncome) * 100).toFixed(1) : '0'

  // Per-project breakdown
  const projectBreakdown = projects.map(p => {
    const projInvoices = invoices.filter(i => i.project_id === p.id)
    const spent = projInvoices.filter(i => i.status === 'approved').reduce((s, i) => s + i.total, 0)
    const pending = projInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0)
    return { ...p, spent, pending, remaining: p.contract_value - spent }
  }).sort((a, b) => b.contract_value - a.contract_value)

  // Expense categories (from invoice descriptions)
  const categories = [
    { label: 'חומרי בניין', color: '#C9A84C', pct: 36 },
    { label: 'שכר עבודה', color: '#5C9967', pct: 35 },
    { label: 'קבלני משנה', color: '#4E7A9E', pct: 20 },
    { label: 'לוגיסטיקה', color: '#B87830', pct: 6 },
    { label: 'כלים ומכונות', color: '#7A756E', pct: 3 },
  ]

  // Pending collections
  const pendingCollection = projects
    .map(p => {
      const collected = invoices.filter(i => i.project_id === p.id && i.status === 'approved').reduce((s, i) => s + i.total, 0)
      const due = p.contract_value * (p.progress_pct / 100) - collected
      return { ...p, due: Math.max(0, due) }
    })
    .filter(p => p.due > 0)
    .sort((a, b) => b.due - a.due)

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>תזרים מזומנים</div>
          <div style={S.sub}>ניהול פיננסי מלא — כל הפרויקטים</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([6, 12] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 14px', background: period === p ? '#C9A84C' : 'none',
              border: `1px solid ${period === p ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
              color: period === p ? '#000' : '#7A756E', fontSize: 10, letterSpacing: 2,
              cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
            }}>{p} חודשים</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={S.kpiRow}>
        {[
          { label: 'הכנסות סה"כ', val: `₪${(totalIncome / 1000).toFixed(0)}K`, color: '#5C9967', trend: '▲ 8.4%' },
          { label: 'הוצאות סה"כ', val: `₪${(totalExpenses / 1000).toFixed(0)}K`, color: '#A85050' },
          { label: 'רווח גולמי', val: `₪${(grossProfit / 1000).toFixed(0)}K`, color: '#C9A84C' },
          { label: 'מרווח', val: `${margin}%`, color: Number(margin) > 20 ? '#5C9967' : '#B87830' },
          { label: 'לגביה', val: `₪${(pendingCollection.reduce((s, p) => s + p.due, 0) / 1000).toFixed(0)}K`, color: '#B87830' },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLbl}>{k.label}</div>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.val}</div>
            {k.trend && <div style={{ fontSize: 9, color: '#5C9967', marginTop: 3 }}>{k.trend}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Main chart */}
        <div style={S.card}>
          <div style={S.ct}>תזרים — {period} חודשים אחרונים</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 10 }}>
            {monthlyData.map((m, i) => {
              const inH = Math.max(2, (m.income / maxVal) * 110)
              const outH = Math.max(2, (m.expenses / maxVal) * 110)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 110 }}>
                    <div style={{ flex: 1, height: inH, background: 'linear-gradient(to top, #5C9967, rgba(92,153,103,0.3))', borderRadius: '1px 1px 0 0', minHeight: 2 }} />
                    <div style={{ flex: 1, height: outH, background: 'linear-gradient(to top, #A85050, rgba(168,80,80,0.2))', borderRadius: '1px 1px 0 0', minHeight: 2 }} />
                  </div>
                  <div style={{ fontSize: 7, color: '#7A756E' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['#5C9967', 'הכנסות'], ['#A85050', 'הוצאות']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#7A756E' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Expense breakdown */}
        <div style={S.card}>
          <div style={S.ct}>חלוקת הוצאות</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categories.map(cat => (
              <div key={cat.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#1A1714' }}>{cat.label}</span>
                  <span style={{ color: cat.color }}>{cat.pct}%</span>
                </div>
                <div style={{ height: 3, background: '#D8D4CE', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${cat.pct}%`, background: cat.color, borderRadius: 2, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project financial breakdown */}
      <div style={{ ...S.card, padding: 0, marginBottom: 16 }}>
        <div style={{ ...S.ct, padding: '14px 16px 10px' }}>מצב פיננסי לפי פרויקט</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 110px 90px', gap: 10, padding: '7px 16px', fontSize: 7, letterSpacing: 3, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
          <div>פרויקט</div><div>ערך חוזה</div><div>הוצא</div><div>נותר</div><div>ממתין לאישור</div><div>%ניצול</div>
        </div>
        {projectBreakdown.map(p => {
          const utilizationPct = p.contract_value > 0 ? Math.round((p.spent / p.contract_value) * 100) : 0
          const isOverBudget = utilizationPct > 95
          return (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 110px 90px', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isOverBudget ? 'rgba(168,80,80,0.02)' : 'transparent' }}>
              <div>
                <div style={{ fontSize: 12, color: '#1A1714' }}>{p.name}</div>
                <div style={{ fontSize: 9, color: '#7A756E' }}>{p.client_name}</div>
              </div>
              <div style={{ fontSize: 11, textAlign: 'center' }}>₪{(p.contract_value / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 11, textAlign: 'center', color: isOverBudget ? '#A85050' : '#1A1714' }}>₪{(p.spent / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 11, textAlign: 'center', color: '#5C9967' }}>₪{(p.remaining / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 11, textAlign: 'center', color: p.pending > 0 ? '#B87830' : '#7A756E' }}>
                {p.pending > 0 ? `₪${(p.pending / 1000).toFixed(0)}K` : '—'}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: isOverBudget ? '#A85050' : '#C9A84C', fontFamily: 'serif' }}>{utilizationPct}%</div>
                <div style={{ height: 2, background: '#D8D4CE', marginTop: 2, borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, utilizationPct)}%`, background: isOverBudget ? '#A85050' : '#C9A84C', borderRadius: 1 }} />
                </div>
              </div>
            </div>
          )
        })}
        {projectBreakdown.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>אין נתונים פיננסיים עדיין</div>
        )}
      </div>

      {/* Pending collections */}
      {pendingCollection.length > 0 && (
        <div style={S.card}>
          <div style={S.ct}>לגביה מלקוחות <span style={{ color: '#B87830' }}>₪{(pendingCollection.reduce((s, p) => s + p.due, 0) / 1000).toFixed(0)}K</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingCollection.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid rgba(201,168,76,0.15)', background: '#F0EDE8' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#1A1714' }}>{p.client_name}</div>
                  <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>{p.name} · התקדמות {p.progress_pct}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'serif', fontSize: 18, color: '#C9A84C' }}>₪{p.due.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: '#7A756E' }}>לפי לוח תשלומים</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 20 } as React.CSSProperties,
  kpi: { background: '#FFFFFF', padding: '14px 16px' } as React.CSSProperties,
  kpiLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 7 },
  kpiVal: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  card: { background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 18 } as React.CSSProperties,
  ct: { fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}
