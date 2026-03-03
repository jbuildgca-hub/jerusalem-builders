import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore, useAppStore } from '../../store'
import { workers as workersDb } from '../../lib/supabase'
import type { Worker, WorkerStatus } from '../../types'
import toast from 'react-hot-toast'

const STATUS_HE: Record<WorkerStatus, string> = { on_site: 'באתר', off_site: 'יצא', unavailable: 'לא זמין' }
const STATUS_COLOR: Record<WorkerStatus, string> = { on_site: '#5C9967', off_site: '#7A756E', unavailable: '#A85050' }

interface MeckanoRow { name: string; date: string; hours: number; department: string }
interface MeckanoSummary { name: string; totalHours: number; days: number; avgHoursPerDay: number; department: string }

function parseMeckanoCSV(text: string): MeckanoRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  const rows: MeckanoRow[] = []
  const startIdx = lines.findIndex(l => l.includes('שם') || l.includes('תאריך') || l.includes('Name') || l.includes('Date'))
  const dataStart = startIdx >= 0 ? startIdx + 1 : 0
  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split(/,|\t/).map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 4) continue
    const hours = parseFloat(cols[5] || cols[4] || '0') || 0
    if (!hours || hours <= 0) continue
    rows.push({ name: cols[0] || '', date: cols[2] || '', hours, department: cols[6] || cols[7] || '' })
  }
  return rows
}

function aggregateMeckano(rows: MeckanoRow[]): MeckanoSummary[] {
  const map = new Map<string, MeckanoSummary>()
  for (const row of rows) {
    const ex = map.get(row.name)
    if (ex) { ex.totalHours += row.hours; ex.days += 1 }
    else map.set(row.name, { name: row.name, totalHours: row.hours, days: 1, avgHoursPerDay: row.hours, department: row.department })
  }
  for (const s of map.values()) s.avgHoursPerDay = Math.round((s.totalHours / s.days) * 10) / 10
  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
}

export default function TeamSection() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const [workerList, setWorkerList] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'map' | 'workers' | 'salary' | 'meckano'>('map')
  const [showAdd, setShowAdd] = useState(false)
  const [showTime, setShowTime] = useState<Worker | null>(null)
  const [meckanoData, setMeckanoData] = useState<MeckanoSummary[] | null>(null)
  const [meckanoLoading, setMeckanoLoading] = useState(false)
  const [meckanoImported, setMeckanoImported] = useState(false)

  useEffect(() => {
    if (!user) return
    workersDb.list(user.id).then(({ data }) => { setWorkerList(data ?? []); setLoading(false) })
  }, [user?.id])

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setMeckanoLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseMeckanoCSV(text)
      if (rows.length === 0) { toast.error('לא נמצאו שורות תקינות — בדוק פורמט'); setMeckanoLoading(false); return }
      setMeckanoData(aggregateMeckano(rows))
      setMeckanoLoading(false)
      toast.success(`נמצאו ${rows.length} רשומות`)
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'], 'application/vnd.ms-excel': ['.xls'] },
    maxFiles: 1,
  })

  const applyMeckano = async () => {
    if (!meckanoData) return
    let matched = 0
    for (const s of meckanoData) {
      const worker = workerList.find(w => w.name.includes(s.name.split(' ')[0]) || s.name.includes(w.name.split(' ')[0]))
      if (worker) {
        await workersDb.update(worker.id, { hours_this_month: s.totalHours, status: 'on_site' })
        setWorkerList(prev => prev.map(w => w.id === worker.id ? { ...w, hours_this_month: s.totalHours, status: 'on_site' } : w))
        matched++
      }
    }
    setMeckanoImported(true)
    toast.success(`עודכנו ${matched} עובדים!`)
  }

  const onSite = workerList.filter(w => w.status === 'on_site')
  const totalSalary = workerList.reduce((s, w) => s + w.hours_this_month * w.hourly_rate, 0)
  const totalHours = workerList.reduce((s, w) => s + w.hours_this_month, 0)
  const notReported = workerList.filter(w => w.status !== 'unavailable' && w.hours_this_month === 0)

  const updateStatus = async (id: string, status: WorkerStatus) => {
    await workersDb.update(id, { status })
    setWorkerList(prev => prev.map(w => w.id === id ? { ...w, status } : w))
  }

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>צוות ועובדים</div>
          <div style={S.sub}>{workerList.length} עובדים · {onSite.length} באתרים כעת</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnOutline} onClick={() => setTab('meckano')}>↓ Meckano</button>
          <button style={S.btnGold} onClick={() => setShowAdd(true)}>+ עובד חדש</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={S.kpiRow}>
        {[
          { label: 'באתרים כעת', val: onSite.length, color: '#5C9967', sub: `מתוך ${workerList.length}` },
          { label: 'שעות החודש', val: totalHours.toLocaleString(), color: '#C9A84C', sub: 'כל הצוות' },
          { label: 'עלות שכר', val: `₪${(totalSalary / 1000).toFixed(0)}K`, color: '#A85050', sub: 'חודש נוכחי' },
          { label: 'לא דיווחו', val: notReported.length, color: notReported.length > 0 ? '#B87830' : '#5C9967', sub: notReported.length > 0 ? 'זקוקים לטיפול' : 'הכל תקין ✓' },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLbl}>{k.label}</div>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 9, color: '#A09890', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {notReported.length > 0 && (
        <div style={{ padding: '10px 16px', border: '1px solid rgba(184,120,48,0.3)', background: 'rgba(184,120,48,0.03)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12 }}>⚠ &nbsp;<strong style={{ color: '#B87830' }}>{notReported.map(w => w.name).join(' · ')}</strong>&nbsp;— לא דיווחו שעות</span>
          <button style={S.btnMini} onClick={() => toast('שלח תזכורת WhatsApp', { icon: '📱' })}>שלח תזכורת</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: 0 }}>
        {([['map','📍 מיקום חי'],['workers','👷 כל הצוות'],['salary','💰 שכר'],['meckano','📊 Meckano']] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 16px', background: 'none', border: 'none', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: tab === id ? '#C9A84C' : '#7A756E', borderBottom: `2px solid ${tab === id ? '#C9A84C' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>{lbl}</button>
        ))}
      </div>

      {/* MAP TAB */}
      {tab === 'map' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none', display: 'grid', gridTemplateColumns: '1fr 260px' }}>
          <div style={{ padding: 18, borderLeft: '1px solid rgba(201,168,76,0.08)' }}>
            <div style={S.ct}>פיזור עובדים — אתרים פעילים</div>
            {projects.filter(p => p.status === 'active').map(proj => {
              const pw = workerList.filter(w => w.current_project_id === proj.id)
              return (
                <div key={proj.id} style={{ marginBottom: 14, padding: '12px 14px', border: '1px solid rgba(201,168,76,0.1)', background: '#F0EDE8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div><div style={{ fontSize: 12, color: '#1A1714' }}>{proj.name}</div><div style={{ fontSize: 9, color: '#7A756E' }}>{proj.address}</div></div>
                    <div style={{ fontSize: 10, color: '#5C9967' }}>{pw.filter(w => w.status === 'on_site').length} באתר</div>
                  </div>
                  {pw.length === 0
                    ? <div style={{ fontSize: 10, color: '#A09890' }}>אין עובדים משויכים</div>
                    : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {pw.map(w => (
                          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', border: `1px solid ${STATUS_COLOR[w.status]}30`, background: `${STATUS_COLOR[w.status]}0A` }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[w.status] }} />
                            <span style={{ fontSize: 10, color: '#1A1714' }}>{w.name}</span>
                            <span style={{ fontSize: 8, color: '#7A756E' }}>{w.role}</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )
            })}
            {projects.filter(p => p.status === 'active').length === 0 && <div style={S.empty}>אין פרויקטים פעילים</div>}
          </div>
          <div style={{ padding: 14 }}>
            <div style={S.ct}>סטטוס נוכחי</div>
            {workerList.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', border: '1px solid rgba(201,168,76,0.06)', background: '#F0EDE8', marginBottom: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[w.status], flexShrink: 0, boxShadow: w.status === 'on_site' ? `0 0 5px ${STATUS_COLOR[w.status]}` : 'none' }} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#1A1714' }}>{w.name}</div><div style={{ fontSize: 8, color: '#7A756E' }}>{w.role}</div></div>
                <select value={w.status} onChange={e => updateStatus(w.id, e.target.value as WorkerStatus)} style={{ background: 'transparent', border: 'none', color: STATUS_COLOR[w.status], fontSize: 8, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                  {(Object.entries(STATUS_HE) as [WorkerStatus,string][]).map(([k,v]) => <option key={k} value={k} style={{ background: '#FFFFFF', color: '#1A1714' }}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WORKERS TAB */}
      {tab === 'workers' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 110px 80px 70px 90px 80px 80px', gap: 8, padding: '7px 16px', fontSize: 7, letterSpacing: 2.5, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <div /><div>עובד</div><div>אתר</div><div>שעות</div><div>שעתי</div><div>שכר חודש</div><div>סטטוס</div><div />
          </div>
          {loading && <div style={S.empty}>טוען...</div>}
          {!loading && workerList.length === 0 && <div style={S.empty}>אין עובדים — הוסף עובד ראשון</div>}
          {workerList.map(w => {
            const proj = projects.find(p => p.id === w.current_project_id)
            return (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 110px 80px 70px 90px 80px 80px', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8E5E0', border: `1px solid ${STATUS_COLOR[w.status]}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontSize: 12, color: '#C9A84C' }}>{w.name[0]}</div>
                <div><div style={{ fontSize: 12, color: '#1A1714' }}>{w.name}</div><div style={{ fontSize: 9, color: '#7A756E' }}>{w.role}{w.phone && ` · ${w.phone}`}</div></div>
                <div style={{ fontSize: 10, color: '#4E7A9E' }}>{proj?.name?.split('—')[0]?.trim() ?? '—'}</div>
                <div style={{ fontSize: 13, textAlign: 'center', fontFamily: 'serif', color: w.hours_this_month === 0 ? '#A85050' : '#1A1714' }}>{w.hours_this_month}</div>
                <div style={{ fontSize: 11, textAlign: 'center', color: '#7A756E' }}>₪{w.hourly_rate}</div>
                <div style={{ fontSize: 14, fontFamily: 'serif', color: '#C9A84C', textAlign: 'center' }}>₪{(w.hours_this_month * w.hourly_rate).toLocaleString()}</div>
                <select value={w.status} onChange={e => updateStatus(w.id, e.target.value as WorkerStatus)} style={{ background: '#E8E5E0', border: `1px solid ${STATUS_COLOR[w.status]}40`, color: STATUS_COLOR[w.status], fontSize: 9, padding: '4px 6px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                  {(Object.entries(STATUS_HE) as [WorkerStatus,string][]).map(([k,v]) => <option key={k} value={k} style={{ background: '#FFFFFF', color: '#1A1714' }}>{v}</option>)}
                </select>
                <button onClick={() => setShowTime(w)} style={S.btnMini}>+ שעות</button>
              </div>
            )
          })}
        </div>
      )}

      {/* SALARY TAB */}
      {tab === 'salary' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 110px', gap: 8, padding: '7px 16px', fontSize: 7, letterSpacing: 2.5, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <div>עובד</div><div>שעתי</div><div>שעות</div><div>ימים</div><div>לתשלום</div>
          </div>
          {workerList.map(w => {
            const pay = w.hours_this_month * w.hourly_rate
            return (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 110px', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: w.hours_this_month === 0 ? 'rgba(168,80,80,0.02)' : 'transparent' }}>
                <div><div style={{ fontSize: 12, color: '#1A1714' }}>{w.name}</div><div style={{ fontSize: 9, color: '#7A756E' }}>{w.role}</div></div>
                <div style={{ fontSize: 11, color: '#7A756E', textAlign: 'center' }}>₪{w.hourly_rate}</div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontFamily: 'serif', color: w.hours_this_month === 0 ? '#A85050' : '#1A1714' }}>{w.hours_this_month}</span>
                  {w.hours_this_month === 0 && <div style={{ fontSize: 8, color: '#B87830' }}>⚠ לא דיווח</div>}
                </div>
                <div style={{ fontSize: 11, color: '#7A756E', textAlign: 'center' }}>{Math.round(w.hours_this_month / 9)}</div>
                <div style={{ fontFamily: 'serif', fontSize: 16, color: pay === 0 ? '#7A756E' : '#C9A84C', textAlign: 'center' }}>₪{pay.toLocaleString()}</div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 110px', gap: 8, padding: '12px 16px', borderTop: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.03)' }}>
            <div style={{ fontSize: 11, color: '#C9A84C' }}>סה"כ לתשלום</div>
            <div /><div style={{ fontSize: 13, fontFamily: 'serif', color: '#1A1714', textAlign: 'center' }}>{totalHours}</div><div />
            <div style={{ fontFamily: 'serif', fontSize: 20, color: '#C9A84C', textAlign: 'center' }}>₪{totalSalary.toLocaleString()}</div>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
            <button style={{ ...S.btnOutline, fontSize: 9 }} onClick={() => {
              const csv = ['שם,תפקיד,שעתי,שעות,לתשלום', ...workerList.map(w => `${w.name},${w.role},${w.hourly_rate},${w.hours_this_month},${w.hours_this_month * w.hourly_rate}`)].join('\n')
              const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
              a.download = `שכר-${new Date().toLocaleDateString('he-IL')}.csv`; a.click()
              toast.success('ייצוא CSV לחשבשבת!')
            }}>⬇ ייצוא CSV לחשבשבת</button>
          </div>
        </div>
      )}

      {/* MECKANO TAB */}
      {tab === 'meckano' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={S.ct}>שלבי ייבוא מ-Meckano</div>
              {[['1','כנס ל-Meckano → דוחות → נוכחות'],['2','בחר חודש נוכחי'],['3','לחץ ייצוא → CSV'],['4','גרור קובץ לכאן ←'],['5','המערכת תשייך אוטומטית']].map(([n,t]) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#C9A84C', flexShrink: 0 }}>{n}</div>
                  <div style={{ fontSize: 11, color: '#1A1714', paddingTop: 2 }}>{t}</div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid rgba(78,122,158,0.2)', background: 'rgba(78,122,158,0.04)', fontSize: 10, color: '#4E7A9E', lineHeight: 1.6 }}>
                💡 המערכת מזהה עובדים לפי שם. ודא שהשמות תואמים.
              </div>
            </div>
            <div>
              <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`, padding: 28, textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(201,168,76,0.04)' : '#F0EDE8', transition: '.2s', marginBottom: 14 }}>
                <input {...getInputProps()} />
                <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 11, color: isDragActive ? '#C9A84C' : '#7A756E' }}>{meckanoLoading ? 'מעבד...' : isDragActive ? 'שחרר...' : 'גרור קובץ Meckano'}</div>
                <div style={{ fontSize: 9, color: '#A09890', marginTop: 4 }}>CSV · XLS · TXT</div>
              </div>
              {meckanoData && (
                <div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C9967', textTransform: 'uppercase', marginBottom: 10 }}>{meckanoData.length} עובדים נמצאו</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                    {meckanoData.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}>
                        <div><div style={{ color: '#1A1714' }}>{m.name}</div><div style={{ fontSize: 9, color: '#7A756E' }}>{m.days} ימים · ממוצע {m.avgHoursPerDay}ש'/יום</div></div>
                        <div style={{ fontFamily: 'serif', fontSize: 16, color: '#C9A84C' }}>{m.totalHours}ש'</div>
                      </div>
                    ))}
                  </div>
                  {!meckanoImported
                    ? <button onClick={applyMeckano} style={{ ...S.btnGold, width: '100%', padding: '11px' }}>✓ עדכן עובדים מ-Meckano</button>
                    : <div style={{ padding: '10px', textAlign: 'center', border: '1px solid rgba(92,153,103,0.3)', color: '#5C9967', fontSize: 11 }}>✓ הנתונים עודכנו בהצלחה</div>
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddWorkerModal userId={user!.id} projects={projects} onClose={() => setShowAdd(false)} onCreate={(w) => { setWorkerList(p => [...p, w]); toast.success('עובד נוסף!') }} />}
      {showTime && <LogTimeModal worker={showTime} projects={projects} onClose={() => setShowTime(null)} onSaved={(h) => { setWorkerList(prev => prev.map(w => w.id === showTime.id ? { ...w, hours_this_month: w.hours_this_month + h } : w)); toast.success(`${h} שעות נרשמו!`) }} />}
    </div>
  )
}

function AddWorkerModal({ userId, projects, onClose, onCreate }: { userId: string; projects: any[]; onClose: () => void; onCreate: (w: Worker) => void }) {
  const [form, setForm] = useState({ name: '', role: '', hourly_rate: '', phone: '', current_project_id: '', type: 'employee' })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const { data, error } = await workersDb.create({ user_id: userId, name: form.name, role: form.type === 'sub' ? `קבלן משנה — ${form.role}` : form.role, hourly_rate: Number(form.hourly_rate), phone: form.phone, status: 'off_site', current_project_id: form.current_project_id || undefined, hours_this_month: 0 })
    setLoading(false)
    if (error) { toast.error(error); return }
    if (data) { onCreate(data); onClose() }
  }

  return (
    <Modal title="עובד חדש" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {[['employee','שכיר'],['sub','קבלן משנה']].map(([id,lbl]) => (
            <button key={id} type="button" onClick={() => set('type', id)} style={{ flex: 1, padding: '7px', background: form.type === id ? 'rgba(201,168,76,0.1)' : 'none', border: `1px solid ${form.type === id ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`, color: form.type === id ? '#C9A84C' : '#7A756E', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FF label="שם מלא *" value={form.name} onChange={v => set('name', v)} required />
          <FF label="תפקיד *" value={form.role} onChange={v => set('role', v)} placeholder="מרצף..." required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FF label="שעתי (₪) *" value={form.hourly_rate} onChange={v => set('hourly_rate', v)} type="number" required />
          <FF label="טלפון" value={form.phone} onChange={v => set('phone', v)} placeholder="050-0000000" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={S.fLbl}>אתר נוכחי</label>
          <select value={form.current_project_id} onChange={e => set('current_project_id', e.target.value)} style={S.fInp as React.CSSProperties}>
            <option value="">— לא משויך —</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...S.btnOutline, flex: 1 }}>ביטול</button>
          <button type="submit" disabled={loading} style={{ ...S.btnGold, flex: 2 }}>{loading ? '...' : 'הוסף עובד'}</button>
        </div>
      </form>
    </Modal>
  )
}

function LogTimeModal({ worker, projects, onClose, onSaved }: { worker: Worker; projects: any[]; onClose: () => void; onSaved: (h: number) => void }) {
  const [hours, setHours] = useState(''); const [projectId, setProjectId] = useState(worker.current_project_id ?? ''); const [date, setDate] = useState(new Date().toISOString().split('T')[0]); const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!projectId) { toast.error('בחר פרויקט'); return }; setLoading(true)
    await workersDb.logTime({ worker_id: worker.id, project_id: projectId, date, hours: Number(hours) })
    await workersDb.update(worker.id, { hours_this_month: worker.hours_this_month + Number(hours), status: 'on_site', current_project_id: projectId })
    setLoading(false); onSaved(Number(hours)); onClose()
  }

  return (
    <Modal title={`שעות — ${worker.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FF label="תאריך" value={date} onChange={setDate} type="date" />
          <FF label="שעות *" value={hours} onChange={setHours} type="number" placeholder="9" required />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={S.fLbl}>פרויקט *</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} required style={S.fInp as React.CSSProperties}>
            <option value="">— בחר —</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {hours && <div style={{ padding: '9px 12px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 11 }}>עלות: <strong style={{ color: '#C9A84C' }}>₪{(Number(hours) * worker.hourly_rate).toLocaleString()}</strong></div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...S.btnOutline, flex: 1 }}>ביטול</button>
          <button type="submit" disabled={loading} style={{ ...S.btnGold, flex: 2 }}>{loading ? '...' : 'שמור'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.2)', padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}><div style={{ fontSize: 15, fontFamily: 'serif', color: '#1A1714' }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7A756E', cursor: 'pointer', fontSize: 18 }}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

function FF({ label, value, onChange, type = 'text', placeholder = '', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={S.fLbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} style={S.fInp as React.CSSProperties} onFocus={e => e.target.style.borderColor = '#C9A84C'} onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.15)'} />
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  ct: { fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 14 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 16 } as React.CSSProperties,
  kpi: { background: '#FFFFFF', padding: '14px 16px' } as React.CSSProperties,
  kpiLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 7 },
  kpiVal: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  empty: { padding: 24, textAlign: 'center' as const, color: '#7A756E', fontSize: 11 },
  btnGold: { padding: '9px 18px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 14px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnMini: { padding: '4px 10px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 },
  fLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E' },
  fInp: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%', transition: '.2s' },
}
