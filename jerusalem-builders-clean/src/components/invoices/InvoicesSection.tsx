import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { invoices as invoicesDb } from '../../lib/supabase'
import { useAuthStore, useAppStore } from '../../store'
import type { Invoice } from '../../types'
import toast from 'react-hot-toast'

export default function InvoicesSection() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [extracted, setExtracted] = useState<Partial<Invoice> | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    invoicesDb.list(user.id).then(({ data }) => {
      setInvoiceList(data ?? [])
      setLoading(false)
    })
  }, [user?.id])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file || !user) return
    setScanning(true)
    setExtracted(null)

    // Skip Supabase Storage - send file directly to AI
    const { data, error } = await invoicesDb.extractWithAI('', file)
    if (error || !data) {
      toast.error('שגיאה בחילוץ נתוני AI')
      setScanning(false)
      return
    }

    setExtracted(data)
    setScanning(false)
    toast.success('AI חילץ את הנתונים בהצלחה!')
  }, [user?.id])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'application/pdf': [] }, maxFiles: 1,
  })

  const handleApprove = async () => {
    if (!extracted || !user) return
    const { data, error } = await invoicesDb.create({
      user_id: user.id,
      project_id: selectedProjectId || undefined,
      supplier_name: extracted.supplier_name ?? '—',
      invoice_number: extracted.invoice_number ?? '—',
      invoice_date: extracted.invoice_date ?? new Date().toISOString().split('T')[0],
      description: extracted.description ?? '',
      subtotal: extracted.subtotal ?? 0,
      tax: extracted.tax ?? 0,
      total: extracted.total ?? 0,
      status: 'approved',
      image_url: uploadedUrl ?? undefined,
      ai_extracted: true,
    })
    if (error) { toast.error(error); return }
    if (data) {
      setInvoiceList(prev => [data, ...prev])
      setExtracted(null)
      setUploadedUrl(null)
      toast.success('חשבונית נשמרה ושויכה!')
    }
  }

  const totalPending = invoiceList.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0)
  const totalApproved = invoiceList.filter(i => i.status === 'approved').reduce((s, i) => s + i.total, 0)

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>חשבוניות — AI סריקה</div>
          <div style={S.sub}>סרוק חשבונית → AI מחלץ נתונים → שייך לפרויקט</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 20 }}>
        {[
          { label: 'סה"כ החודש', val: `₪${(totalApproved / 1000).toFixed(0)}K`, color: '#C9A84C' },
          { label: 'ממתינות לאישור', val: invoiceList.filter(i => i.status === 'pending').length, color: '#A85050' },
          { label: 'אושרו', val: invoiceList.filter(i => i.status === 'approved').length, color: '#5C9967' },
          { label: 'ספקים', val: new Set(invoiceList.map(i => i.supplier_name)).size, color: '#1A1714' },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLabel}>{k.label}</div>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Left: upload + results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Dropzone */}
          <div style={S.card}>
            <div style={S.cardTitle}>סריקת חשבונית חדשה</div>
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`,
              padding: 28, textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? 'rgba(201,168,76,0.03)' : '#FFFFFF',
              transition: '.2s',
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 30, marginBottom: 8, opacity: .35 }}>📄</div>
              <div style={{ fontSize: 11, color: '#7A756E' }}>
                {isDragActive ? 'שחרר כאן...' : 'גרור חשבונית לכאן או לחץ לבחירה'}
              </div>
              <div style={{ fontSize: 9, color: '#A09890', marginTop: 4 }}>תמונה · PDF</div>
            </div>

            {scanning && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, margin: '12px 0', border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.03)' }}>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#C9A84C' }}>AI מנתח חשבונית...</span>
              </div>
            )}

            {extracted && !scanning && (
              <div style={{ marginTop: 14, border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.02)', padding: 16 }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: '#C9A84C', marginBottom: 12 }}>נתונים שחולצו ✓ AI</div>
                {[
                  ['ספק', extracted.supplier_name],
                  ['מספר חשבונית', extracted.invoice_number],
                  ['תאריך', extracted.invoice_date],
                  ['פירוט', extracted.description],
                  ['לפני מע"מ', extracted.subtotal ? `₪${Number(extracted.subtotal).toLocaleString()}` : '—'],
                  ['מע"מ', extracted.tax ? `₪${Number(extracted.tax).toLocaleString()}` : '—'],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}>
                    <span style={{ color: '#7A756E' }}>{k}</span>
                    <span style={{ color: '#1A1714' }}>{v || '—'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 11 }}>
                  <span style={{ color: '#7A756E' }}>סה"כ לתשלום</span>
                  <span style={{ fontFamily: 'serif', fontSize: 20, color: '#C9A84C' }}>₪{Number(extracted.total || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={{ flex: 1, ...S.fInput as React.CSSProperties }}>
                    <option value="">— שייך לפרויקט —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={handleApprove} style={S.btnGold}>✓ אשר ושמור</button>
                </div>
              </div>
            )}
          </div>

          {/* Invoice list */}
          <div style={{ ...S.card, padding: 0 }}>
            <div style={{ ...S.cardTitle, padding: '14px 16px 10px' }}>חשבוניות אחרונות</div>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>טוען...</div>}
            {!loading && invoiceList.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>אין חשבוניות עדיין</div>
            )}
            {invoiceList.map(inv => (
              <div key={inv.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: inv.status === 'pending' ? 'rgba(184,120,48,0.02)' : 'transparent',
                cursor: 'pointer', transition: '.15s',
              }}>
                <div style={{ fontSize: 16, flexShrink: 0 }}>
                  {inv.ai_extracted ? '🤖' : '📄'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 400, color: '#1A1714' }}>{inv.supplier_name}</div>
                  <div style={{ fontSize: 9, color: '#7A756E' }}>{inv.description}</div>
                  {inv.project && <div style={{ fontSize: 8, color: '#4E7A9E', marginTop: 2 }}>{inv.project.name}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'serif', fontSize: 16, color: '#C9A84C' }}>₪{inv.total.toLocaleString()}</div>
                  <div style={{
                    fontSize: 7, letterSpacing: 1.5, padding: '2px 6px',
                    color: inv.status === 'approved' ? '#5C9967' : '#B87830',
                    border: `1px solid ${inv.status === 'approved' ? 'rgba(92,153,103,.25)' : 'rgba(184,120,48,.25)'}`,
                    textTransform: 'uppercase',
                  }}>
                    {inv.status === 'approved' ? 'אושר ✓' : 'ממתין'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cardTitle}>הוצאות לפי פרויקט</div>
            {projects.map(p => {
              const projTotal = invoiceList.filter(i => i.project_id === p.id && i.status === 'approved').reduce((s, i) => s + i.total, 0)
              const max = Math.max(...projects.map(pp => invoiceList.filter(i => i.project_id === pp.id).reduce((s, i) => s + i.total, 0)), 1)
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#1A1714' }}>{p.name.split('—')[0].trim()}</span>
                    <span style={{ color: '#C9A84C' }}>₪{(projTotal / 1000).toFixed(0)}K</span>
                  </div>
                  <div style={{ height: 3, background: '#D8D4CE', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(projTotal / max) * 100}%`, background: '#C9A84C', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
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
  cardTitle: { fontSize: 8, letterSpacing: 3.5, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 14 },
  kpi: { background: '#FFFFFF', padding: '16px 18px' } as React.CSSProperties,
  kpiLabel: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 8 },
  kpiVal: { fontFamily: 'serif', fontSize: 28, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  btnGold: { padding: '9px 16px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  fInput: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none' },
}
