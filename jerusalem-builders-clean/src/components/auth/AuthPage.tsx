import { useState } from 'react'
import { auth } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { LOGO_DATA } from '../../lib/logo'

type Mode = 'main' | 'email'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('main')
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await auth.signInWithGoogle()
    if (error) {
      toast.error(error)
      setGoogleLoading(false)
    }
    // Supabase redirects to Google — page will reload on return
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    if (emailMode === 'login') {
      const { error } = await auth.signIn(email, password)
      if (error) toast.error(error)
      else toast.success('ברוך הבא!')
    } else {
      if (!fullName.trim()) { toast.error('נא להזין שם מלא'); setLoading(false); return }
      const { error } = await auth.signUp(email, password, fullName)
      if (error) toast.error(error)
      else toast.success('חשבון נוצר — בדוק את המייל')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F3EF', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: "'Heebo', sans-serif", direction: 'rtl',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400&family=Heebo:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src={LOGO_DATA} alt="Jerusalem Builders" style={{ width: 180, height: 'auto', marginBottom: 8 }} />
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#7A756E', textTransform: 'uppercase' }}>
            פרויקטים בע״מ · מרכז פיקוד
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.15)', padding: 32 }}>

          {/* ── Main screen: Google first ── */}
          {mode === 'main' && (
            <>
              <div style={{ fontSize: 13, color: '#1A1714', textAlign: 'center', marginBottom: 24, fontWeight: 300 }}>
                כניסה למערכת
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                style={{
                  width: '100%', padding: '13px 16px', marginBottom: 12,
                  background: googleLoading ? '#E8E5E0' : '#fff',
                  border: '1px solid rgba(201,168,76,0.2)',
                  color: googleLoading ? '#7A756E' : '#1a1a1a',
                  fontSize: 13, cursor: googleLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Heebo', sans-serif", fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  transition: '.2s',
                }}
              >
                {googleLoading ? (
                  <>
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    מתחבר...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    המשך עם Google
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.1)' }} />
                <span style={{ fontSize: 9, letterSpacing: 2, color: '#A09890', textTransform: 'uppercase' }}>או</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.1)' }} />
              </div>

              {/* Email fallback */}
              <button
                onClick={() => setMode('email')}
                style={{
                  width: '100%', padding: '11px', background: 'none',
                  border: '1px solid rgba(201,168,76,0.15)', color: '#7A756E',
                  fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: "'Heebo', sans-serif", transition: '.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)')}
              >
                כניסה עם מייל וסיסמה
              </button>

              <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(78,122,158,0.06)', border: '1px solid rgba(78,122,158,0.15)', fontSize: 10, color: '#4E7A9E', lineHeight: 1.6, textAlign: 'center' }}>
                מומלץ: כנסו עם חשבון Google של החברה<br />
                <span style={{ fontSize: 9, color: '#A09890' }}>האימות מנוהל על ידי Google — ללא סיסמאות נוספות</span>
              </div>
            </>
          )}

          {/* ── Email screen ── */}
          {mode === 'email' && (
            <>
              <button
                onClick={() => setMode('main')}
                style={{ background: 'none', border: 'none', color: '#7A756E', cursor: 'pointer', fontSize: 11, marginBottom: 20, padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                ← חזרה
              </button>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
                {(['login', 'register'] as const).map(m => (
                  <button key={m} onClick={() => setEmailMode(m)} style={{
                    flex: 1, padding: '9px 0', background: 'none', border: 'none',
                    fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                    color: emailMode === m ? '#C9A84C' : '#7A756E',
                    borderBottom: `2px solid ${emailMode === m ? '#C9A84C' : 'transparent'}`,
                    cursor: 'pointer', fontFamily: "'Heebo', sans-serif", marginBottom: -1, transition: '.2s',
                  }}>
                    {m === 'login' ? 'כניסה' : 'הרשמה'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {emailMode === 'register' && (
                  <Field label="שם מלא" value={fullName} onChange={setFullName} placeholder="אלכסנדר גורן" type="text" />
                )}
                <Field label="אימייל" value={email} onChange={setEmail} placeholder="alex@jbuilders.co.il" type="email" />
                <Field label="סיסמה" value={password} onChange={setPassword} placeholder="לפחות 8 תווים" type="password" />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: 6, padding: '12px', background: loading ? '#8B6914' : '#C9A84C',
                    color: '#000', border: 'none', fontSize: 11, letterSpacing: 3,
                    textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Heebo', sans-serif", transition: '.2s',
                  }}
                >
                  {loading ? '...' : emailMode === 'login' ? 'כניסה' : 'יצירת חשבון'}
                </button>
              </form>

              {emailMode === 'login' && (
                <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10 }}>
                  <a href="#" style={{ color: '#C9A84C', textDecoration: 'none' }}>שכחתי סיסמה</a>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 9, color: '#A09890', letterSpacing: 1 }}>
          ג׳רוזלם בילדרס פרויקטים בע״מ © 2025 · כל הנתונים מוצפנים ומאובטחים
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        style={{ background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '9px 12px', fontSize: 12, fontFamily: "'Heebo', sans-serif", outline: 'none', transition: '.2s' }}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.15)'}
      />
    </div>
  )
}
