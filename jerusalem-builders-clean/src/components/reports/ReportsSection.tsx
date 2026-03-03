import { useState } from 'react'
import { useAuthStore, useAppStore } from '../../store'
import type { Project } from '../../types'
import toast from 'react-hot-toast'
import GoogleDriveExport from './GoogleDriveExport'

type ReportType = 'status' | 'financial' | 'client' | 'workers' | 'materials' | 'delay'

interface ReportDef {
  id: ReportType
  icon: string
  name: string
  desc: string
  tag: string
  forClient: boolean
}

const REPORTS: ReportDef[] = [
  { id: 'status',    icon: '📊', name: 'דוח סטטוס פרויקטים', desc: 'סקירה כוללת — התקדמות, עלויות, עיכובים, חריגות', tag: 'פרויקטים', forClient: false },
  { id: 'financial', icon: '💰', name: 'דוח כספי חודשי',      desc: 'הכנסות, הוצאות, רווחיות לכל פרויקט ובסיכום כולל', tag: 'פיננסי', forClient: false },
  { id: 'client',    icon: '📋', name: 'דוח ללקוח',           desc: 'דוח מקצועי ללקוח — התקדמות, תמונות, לוח תשלומים', tag: 'לקוח', forClient: true },
  { id: 'workers',   icon: '👷', name: 'דוח כוח אדם',         desc: 'שעות, עלות שכר, פיזור עובדים בין פרויקטים', tag: 'עובדים', forClient: false },
  { id: 'materials', icon: '📦', name: 'דוח חומרים',           desc: 'ריכוז רכישות, ספקים, כמויות — לפי פרויקט', tag: 'חומרים', forClient: false },
  { id: 'delay',     icon: '⏱',  name: 'דוח עיכובים',         desc: 'פירוט עיכובים, סיבות, השפעה על לוחות זמנים', tag: 'לו"ז', forClient: false },
]

export default function ReportsSection() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [generating, setGenerating] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)

  const reportDef = REPORTS.find(r => r.id === selectedReport)
  const filteredProjects = selectedProject === 'all' ? projects : projects.filter(p => p.id === selectedProject)

  const generateWithAI = async () => {
    if (!selectedReport) return
    setGenerating(true)
    setAiReport(null)

    const projectSummary = filteredProjects.map(p =>
      `פרויקט: ${p.name} | לקוח: ${p.client_name} | ערך: ₪${p.contract_value.toLocaleString()} | ` +
      `התקדמות: ${p.progress_pct}% | עלות בפועל: ₪${p.actual_cost.toLocaleString()} | סטטוס: ${p.status} | ` +
      `סיום: ${p.end_date}`
    ).join('\n')

    const prompts: Record<ReportType, string> = {
      status: `אתה יועץ ניהול פרויקטים בכיר עבור ג'רוזלם בילדרס פרויקטים בע"מ. צור דוח סטטוס מקצועי בעברית על הפרויקטים הבאים:\n\n${projectSummary}\n\nכלול: סיכום מנהלים, מצב כל פרויקט, חריגות, המלצות. פורמט: כותרות, פסקאות ברורות. אל תשתמש ב-markdown.`,
      financial: `אתה CFO עבור ג'רוזלם בילדרס פרויקטים בע"מ. צור דוח כספי חודשי מקצועי על:\n\n${projectSummary}\n\nכלול: סיכום הכנסות והוצאות, רווחיות לפי פרויקט, תחזית לחודש הבא, המלצות. בעברית ברורה.`,
      client: `אתה עורך דוחות ללקוחות VIP עבור ג'רוזלם בילדרס פרויקטים בע"מ. צור דוח עדכון מקצועי ומכובד ללקוח על הפרויקט:\n\n${projectSummary}\n\nכלול: ברכה אישית, סיכום התקדמות, מה בוצע החודש, מה מתוכנן לחודש הבא, לוח תשלומים, איש קשר. שמור על טון מכבד ומקצועי.`,
      workers: `צור דוח כוח אדם עבור ג'רוזלם בילדרס פרויקטים בע"מ בעברית. פרויקטים:\n\n${projectSummary}\n\nכלול: סיכום עובדים, שעות עבודה, עלות שכר משוערת, פיזור בין פרויקטים, המלצות לייעול.`,
      materials: `צור דוח חומרים ורכש עבור ג'רוזלם בילדרס פרויקטים בע"מ בעברית. פרויקטים:\n\n${projectSummary}\n\nכלול: סיכום חומרים לפי פרויקט, ספקים מרכזיים, המלצות לחיסכון, רכישות מתוכננות.`,
      delay: `צור דוח עיכובים ולוחות זמנים עבור ג'רוזלם בילדרס פרויקטים בע"מ בעברית. פרויקטים:\n\n${projectSummary}\n\nכלול: פרויקטים בעיכוב, ניתוח סיבות, השפעה על לוחות זמנים, המלצות לתיקון.`,
    }

    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompts[selectedReport] }],
        }),
      })
      const data = await resp.json()
      const text = data.content?.map((c: { text?: string }) => c.text || '').join('') || ''
      setAiReport(text)
    } catch {
      toast.error('שגיאה ביצירת הדוח')
    }
    setGenerating(false)
  }

  const printReport = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>${reportDef?.name} — ג'רוזלם בילדרס</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; direction: rtl; }
          h1 { font-size: 24px; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; margin-bottom: 8px; }
          .meta { font-size: 11px; color: #666; margin-bottom: 30px; }
          .brand { font-size: 13px; color: #8B6914; font-weight: bold; margin-bottom: 4px; }
          pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.8; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="brand">ג'רוזלם בילדרס פרויקטים בע"מ</div>
        <h1>${reportDef?.name}</h1>
        <div class="meta">תאריך: ${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · הופק על ידי: ${user?.full_name}</div>
        <pre>${aiReport}</pre>
      </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>מחולל דוחות</div>
          <div style={S.sub}>דוחות מקצועיים — AI כותב, אתה חותם</div>
        </div>
        <GoogleDriveExport />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
        {/* Left: report selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Report type cards */}
          <div style={S.card}>
            <div style={S.ct}>בחר סוג דוח</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORTS.map(r => (
                <div key={r.id} onClick={() => { setSelectedReport(r.id); setAiReport(null) }} style={{
                  padding: '12px 14px', border: `1px solid ${selectedReport === r.id ? '#C9A84C' : 'rgba(201,168,76,0.12)'}`,
                  background: selectedReport === r.id ? 'rgba(201,168,76,0.05)' : '#F0EDE8',
                  cursor: 'pointer', transition: '.15s', display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 20, opacity: .7, flexShrink: 0 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#1A1714', fontWeight: 400 }}>{r.name}</div>
                    <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <span style={{ fontSize: 7, letterSpacing: 1.5, padding: '2px 6px', textTransform: 'uppercase', color: r.forClient ? '#4E7A9E' : '#C9A84C', border: `1px solid ${r.forClient ? 'rgba(78,122,158,0.3)' : 'rgba(201,168,76,0.2)'}`, flexShrink: 0 }}>
                    {r.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Project filter */}
          {selectedReport && (
            <div style={S.card}>
              <div style={S.ct}>פרויקט</div>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ ...S.fInp as React.CSSProperties, width: '100%', marginBottom: 14 }}>
                <option value="all">כל הפרויקטים</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={generateWithAI} disabled={generating} style={{ ...S.btnGold, width: '100%', padding: '11px', fontSize: 11, letterSpacing: 2 }}>
                {generating ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                    AI כותב דוח...
                  </span>
                ) : '✦ צור דוח עם AI'}
              </button>
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div>
          {!selectedReport && (
            <div style={{ ...S.card, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, opacity: .2, marginBottom: 12 }}>▦</div>
              <div style={{ fontSize: 12, color: '#7A756E' }}>בחר סוג דוח להתחיל</div>
            </div>
          )}

          {selectedReport && !aiReport && !generating && (
            <div style={S.card}>
              <div style={S.ct}>{reportDef?.name}</div>
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: .3 }}>{reportDef?.icon}</div>
                <div style={{ fontSize: 12, color: '#7A756E', marginBottom: 6 }}>
                  {selectedProject === 'all' ? `${projects.length} פרויקטים` : projects.find(p => p.id === selectedProject)?.name}
                </div>
                <div style={{ fontSize: 11, color: '#A09890' }}>לחץ "צור דוח עם AI" לקבלת דוח מלא</div>
              </div>

              {/* Static data preview */}
              <div style={{ marginTop: 16, borderTop: '1px solid rgba(201,168,76,0.12)', paddingTop: 16 }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: '#7A756E', textTransform: 'uppercase', marginBottom: 10 }}>נתונים בסיס</div>
                {filteredProjects.slice(0, 4).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 11 }}>
                    <span style={{ color: '#1A1714' }}>{p.name}</span>
                    <span style={{ color: p.status === 'delayed' ? '#A85050' : '#C9A84C', fontFamily: 'serif' }}>{p.progress_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generating && (
            <div style={{ ...S.card, padding: 40, textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 12, color: '#C9A84C' }}>AI מנתח נתונים וכותב דוח...</div>
              <div style={{ fontSize: 10, color: '#7A756E', marginTop: 6 }}>מבוסס על {filteredProjects.length} פרויקטים</div>
            </div>
          )}

          {aiReport && (
            <div style={{ ...S.card, padding: 0 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,0.12)', background: '#F0EDE8' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#1A1714', fontWeight: 400 }}>{reportDef?.name}</div>
                  <div style={{ fontSize: 9, color: '#7A756E', marginTop: 1 }}>{new Date().toLocaleDateString('he-IL')} · {user?.full_name}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAiReport(null)} style={S.btnOutline}>✕ סגור</button>
                  <button onClick={generateWithAI} style={S.btnOutline}>↺ חדש</button>
                  <button onClick={printReport} style={S.btnGold}>⬇ PDF / הדפס</button>
                </div>
              </div>

              {/* Report body */}
              <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#7A756E', textTransform: 'uppercase', marginBottom: 16 }}>
                  ג׳רוזלם בילדרס פרויקטים בע״מ · {new Date().toLocaleDateString('he-IL')}
                </div>
                <pre style={{ fontFamily: 'inherit', fontSize: 12, lineHeight: 1.9, color: '#D0C9BE', whiteSpace: 'pre-wrap', direction: 'rtl' }}>
                  {aiReport}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  card: { background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', padding: 18 } as React.CSSProperties,
  ct: { fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnGold: { padding: '9px 16px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 12px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  fInp: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none' },
}
