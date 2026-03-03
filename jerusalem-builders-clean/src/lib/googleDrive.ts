// ─── Google Drive Integration ─────────────────────────────────────
// Exports project data, invoices, reports to Google Drive

const SCOPES = 'https://www.googleapis.com/auth/drive.file'

declare global {
  interface Window {
    gapi: any
    google: any
  }
}

export async function loadGoogleAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.gapi) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        })
        resolve()
      })
    }
    document.head.appendChild(script)
  })
}

export async function signInToGoogle(): Promise<string | null> {
  return new Promise((resolve) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) { resolve(null); return }
        resolve(response.access_token)
      },
    })
    client.requestAccessToken()
  })
}

export async function uploadToGoogleDrive(
  filename: string,
  content: string,
  mimeType: string,
  accessToken: string
): Promise<string | null> {
  const metadata = { name: filename, mimeType }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([content], { type: mimeType }))

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  if (!res.ok) return null
  const data = await res.json()
  return `https://drive.google.com/file/d/${data.id}/view`
}

export function exportProjectsToCSV(projects: any[]): string {
  const headers = ['שם פרויקט', 'לקוח', 'כתובת', 'סטטוס', 'התקדמות %', 'ערך חוזה', 'עלות בפועל', 'תאריך התחלה', 'תאריך סיום']
  const rows = projects.map(p => [
    p.name, p.client_name, p.address, p.status,
    p.progress_pct, p.contract_value, p.actual_cost,
    p.start_date, p.end_date
  ])
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

export function exportInvoicesToCSV(invoices: any[]): string {
  const headers = ['ספק', 'מספר חשבונית', 'תאריך', 'תיאור', 'סכום', 'מע"מ', 'סה"כ', 'סטטוס']
  const rows = invoices.map(i => [
    i.supplier_name, i.invoice_number, i.invoice_date,
    i.description, i.subtotal, i.tax, i.total, i.status
  ])
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}
