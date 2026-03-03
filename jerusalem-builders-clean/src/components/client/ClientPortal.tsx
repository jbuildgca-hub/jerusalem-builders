import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types'

// ─── Client Portal ────────────────────────────────────────────────
// Accessible via: /client/:token (no login required)
// Token stored in projects table as client_token

export default function ClientPortal({ token }: { token?: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    supabase
      .from('projects')
      .select('*')
      .eq('client_token', token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setProject(data as Project)
        setLoading(false)
      })
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060606', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 11, color: '#7A756E' }}>טוען פרויקט...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#060606', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'serif', fontSize: 22, color: '#C9A84C' }}>ג׳רוזלם בילדרס</div>
      <div style={{ fontSize: 14, color: '#7A756E', textAlign: 'center' }}>הקישור לא תקין או פג תוקפו</div>
      <div style={{ fontSize: 11, color: '#A09890' }}>צור קשר עם מנהל הפרויקט</div>
    </div>
  )

  if (!project) return null

  const progress = project.progress_pct ?? 0
  const paymentSchedule = generatePaymentSchedule(project)
  const paid = paymentSchedule.filter(p => p.paid)
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0)
  const nextPayment = paymentSchedule.find(p => !p.paid)

  return (
    <div style={{ minHeight: '100vh', background: '#060606', color: '#1A1714', fontFamily: "'Segoe UI', Arial, sans-serif", direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: '#090909', borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 20, color: '#C9A84C', letterSpacing: 0.5 }}>ג׳רוזלם בילדרס פרויקטים</div>
          <div style={{ fontSize: 10, color: '#7A756E', marginTop: 2 }}>דשבורד לקוח · עדכון התקדמות</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: '#1A1714' }}>{project.client_name}</div>
          <div style={{ fontSize: 9, color: '#7A756E' }}>{new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Project title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'serif', fontSize: 28, fontWeight: 300, color: '#1A1714', marginBottom: 4 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: '#7A756E' }}>
            {project.address} · {project.area_sqm} מ"ר · {project.work_type}
          </div>
        </div>

        {/* Big progress circle + KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, marginBottom: 24 }}>
          {/* Circle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 24 }}>
            <ProgressRing pct={progress} />
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#7A756E', textTransform: 'uppercase', marginTop: 8 }}>התקדמות</div>
          </div>

          {/* KPIs grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(201,168,76,0.1)' }}>
            {[
              { label: 'תאריך סיום', val: new Date(project.end_date).toLocaleDateString('he-IL'), sub: daysLeft(project.end_date) },
              { label: 'שלב נוכחי', val: currentPhase(progress), sub: `${progress}% הושלם` },
              { label: 'שולם עד כה', val: `₪${(totalPaid / 1000).toFixed(0)}K`, sub: `מתוך ₪${(project.contract_value / 1000).toFixed(0)}K` },
              { label: 'תשלום הבא', val: nextPayment ? `₪${(nextPayment.amount / 1000).toFixed(0)}K` : '✓ שולם הכל', sub: nextPayment?.trigger ?? '' },
            ].map(k => (
              <div key={k.label} style={{ background: '#FFFFFF', padding: '16px 18px' }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: '#7A756E', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: 'serif', fontSize: 22, color: '#C9A84C', lineHeight: 1 }}>{k.val}</div>
                <div style={{ fontSize: 10, color: '#7A756E', marginTop: 5 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress timeline */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 20, marginBottom: 20 }}>
          <div style={S.ct}>שלבי הפרויקט</div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, left: 16, height: 2, background: '#E8E5E0', zIndex: 0 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #C9A84C, #E8D5A3)', transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              {PHASES.map((phase, i) => {
                const phasePct = (i / (PHASES.length - 1)) * 100
                const done = progress >= phasePct
                const active = progress >= phasePct && (i === PHASES.length - 1 || progress < ((i + 1) / (PHASES.length - 1)) * 100)
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: done ? '#C9A84C' : '#E8E5E0',
                      border: `2px solid ${done ? '#C9A84C' : active ? 'rgba(201,168,76,0.4)' : '#D8D4CE'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, boxShadow: active ? '0 0 12px rgba(201,168,76,0.4)' : 'none',
                      transition: '.3s',
                    }}>
                      {done ? <span style={{ color: '#000', fontSize: 14, fontWeight: 'bold' }}>✓</span> : <span style={{ fontSize: 12 }}>{phase.icon}</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: done ? '#1A1714' : '#7A756E', transition: '.3s' }}>{phase.name}</div>
                      <div style={{ fontSize: 8, color: '#A09890' }}>{phase.pct}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Payment schedule */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 20, marginBottom: 20 }}>
          <div style={S.ct}>לוח תשלומים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paymentSchedule.map((pay, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: `1px solid ${pay.paid ? 'rgba(92,153,103,0.2)' : pay.due ? 'rgba(201,168,76,0.2)' : 'rgba(0,0,0,0.06)'}`, background: pay.paid ? 'rgba(92,153,103,0.04)' : pay.due ? 'rgba(201,168,76,0.04)' : '#F0EDE8' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: pay.paid ? 'rgba(92,153,103,0.15)' : pay.due ? 'rgba(201,168,76,0.1)' : '#E8E5E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {pay.paid ? '✓' : pay.due ? '●' : `${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: pay.paid ? '#5C9967' : '#1A1714' }}>{pay.trigger}</div>
                  <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>{pay.pct}% מהחוזה</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: 'serif', fontSize: 18, color: pay.paid ? '#5C9967' : pay.due ? '#C9A84C' : '#7A756E' }}>
                    ₪{pay.amount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 8, color: '#7A756E' }}>{pay.paid ? 'שולם ✓' : pay.due ? 'לתשלום' : 'עתידי'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Updates feed */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 20 }}>
          <div style={S.ct}>עדכונים אחרונים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {generateUpdates(project, progress).map((upd, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? '#C9A84C' : '#A09890', flexShrink: 0, marginTop: 3 }} />
                  {i < 3 && <div style={{ width: 1, flex: 1, background: 'rgba(201,168,76,0.1)', marginTop: 4 }} />}
                </div>
                <div style={{ paddingBottom: 12 }}>
                  <div style={{ fontSize: 11, color: i === 0 ? '#1A1714' : '#7A756E' }}>{upd.text}</div>
                  <div style={{ fontSize: 9, color: '#A09890', marginTop: 2 }}>{upd.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: 10, color: '#A09890' }}>
          ג׳רוזלם בילדרס פרויקטים בע״מ · עמוד זה מתעדכן בזמן אמת
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Progress Ring ────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 54, c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={65} cy={65} r={r} fill="none" stroke="#1A1A1A" strokeWidth={8} />
      <circle cx={65} cy={65} r={r} fill="none" stroke="#C9A84C" strokeWidth={8}
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
      <text x={65} y={65} textAnchor="middle" dominantBaseline="middle"
        fill="#C9A84C" fontSize={26} fontFamily="serif" style={{ transform: 'rotate(90deg)', transformOrigin: '65px 65px' }}>
        {pct}%
      </text>
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────

const PHASES = [
  { name: 'חתימת חוזה', icon: '📝', pct: 0 },
  { name: 'הריסה ועיצוב', icon: '🔨', pct: 15 },
  { name: 'שלד ותשתיות', icon: '🏗', pct: 30 },
  { name: 'גמרים', icon: '🪟', pct: 55 },
  { name: 'ריצוף', icon: '🔲', pct: 70 },
  { name: 'ריהוט ועיצוב', icon: '🛋', pct: 85 },
  { name: 'מסירה', icon: '🔑', pct: 100 },
]

function currentPhase(pct: number): string {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (pct >= PHASES[i].pct) return PHASES[i].name
  }
  return PHASES[0].name
}

function daysLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return `איחור של ${Math.abs(days)} ימים`
  if (days === 0) return 'היום!'
  return `${days} ימים`
}

function generatePaymentSchedule(project: Project) {
  const v = project.contract_value
  const p = project.progress_pct ?? 0
  return [
    { trigger: 'חתימת חוזה', pct: 10, amount: Math.round(v * 0.10), paid: true, due: false },
    { trigger: 'תחילת עבודה', pct: 15, amount: Math.round(v * 0.15), paid: p >= 15, due: p >= 15 && p < 30 },
    { trigger: 'השלמת תשתיות', pct: 25, amount: Math.round(v * 0.25), paid: p >= 40, due: p >= 30 && p < 40 },
    { trigger: 'השלמת גמרים', pct: 25, amount: Math.round(v * 0.25), paid: p >= 70, due: p >= 55 && p < 70 },
    { trigger: 'מסירת מפתח', pct: 20, amount: Math.round(v * 0.20), paid: p >= 100, due: p >= 90 },
    { trigger: 'אחריות (3 חודשים)', pct: 5, amount: Math.round(v * 0.05), paid: false, due: false },
  ]
}

function generateUpdates(project: Project, pct: number) {
  const updates = []
  const now = new Date()
  if (pct >= 70) updates.push({ text: 'ריצוף הושלם בכל חדרי הבית', date: formatRelative(-2) })
  if (pct >= 55) updates.push({ text: 'גמרי גבס וצבע הסתיימו', date: formatRelative(-8) })
  if (pct >= 40) updates.push({ text: 'חשמל ואינסטלציה אושרו על ידי מפקח', date: formatRelative(-15) })
  if (pct >= 20) updates.push({ text: 'עבודות שלד וקונסטרוקציה הושלמו', date: formatRelative(-25) })
  updates.push({ text: `פרויקט ${project.name} התחיל רשמית`, date: formatRelative(-35) })
  return updates.slice(0, 4)
}

function formatRelative(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAgo)
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
}

const S = {
  ct: { fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 16 },
}
