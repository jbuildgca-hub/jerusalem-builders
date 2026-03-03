import { useState } from 'react'
import { loadGoogleAPI, signInToGoogle, uploadToGoogleDrive, exportProjectsToCSV, exportInvoicesToCSV } from '../../lib/googleDrive'
import { useAppStore } from '../../store'
import toast from 'react-hot-toast'

export default function GoogleDriveExport() {
  const { projects } = useAppStore()
  const invoices: any[] = []
  const [loading, setLoading] = useState(false)

  const handleExport = async (type: 'projects' | 'invoices') => {
    setLoading(true)
    try {
      await loadGoogleAPI()
      const token = await signInToGoogle()
      if (!token) { toast.error('לא הצלחנו להתחבר ל-Google Drive'); setLoading(false); return }

      const now = new Date().toLocaleDateString('he-IL').replace(/\//g, '-')
      let csv = '', filename = ''

      if (type === 'projects') {
        csv = exportProjectsToCSV(projects)
        filename = `פרויקטים-${now}.csv`
      } else {
        csv = exportInvoicesToCSV(invoices)
        filename = `חשבוניות-${now}.csv`
      }

      const url = await uploadToGoogleDrive(filename, '\uFEFF' + csv, 'text/csv', token)
      if (url) {
        toast.success('הקובץ הועלה ל-Google Drive!')
        window.open(url, '_blank')
      } else {
        toast.error('שגיאה בהעלאה')
      }
    } catch {
      toast.error('שגיאה — בדוק שה-Google API Key מוגדר')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 10, color: '#7A756E', letterSpacing: 1 }}>ייצוא ל-Google Drive:</div>
      {['projects', 'invoices'].map(type => (
        <button
          key={type}
          onClick={() => handleExport(type as any)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: loading ? '#E8E5E0' : '#fff',
            border: '1px solid rgba(201,168,76,0.2)', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 11, color: '#1A1714', borderRadius: 2,
            fontFamily: 'inherit', transition: '.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 87.3 78"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066da"/><path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0H6.6C5.05 0 3.5.4 2.15 1.2L43.65 25z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.45 9.5 8.3 14.3z" fill="#ea4335"/><path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2L43.65 25z" fill="#00832d"/><path d="M43.65 25L29.9 48.85H59.8L43.65 25z" fill="#2684fc"/><path d="M59.8 48.85H29.9l-2.4 4.15-11.2 19.4c1.35.8 2.9 1.2 4.45 1.2h38.3c1.55 0 3.1-.4 4.45-1.2L59.8 48.85z" fill="#ffba00"/></svg>
          {type === 'projects' ? 'פרויקטים' : 'חשבוניות'}
        </button>
      ))}
    </div>
  )
}
