import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, ROLE_COLORS, ROLE_PERMISSIONS, type UserRole } from '../../lib/permissions'
import toast from 'react-hot-toast'

interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
  last_sign_in?: string
  project_ids?: string[]
}

export default function UsersSection() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers((data as AppUser[]) ?? [])
    setLoading(false)
  }

  const updateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) { toast.error(error.message); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    toast.success('הרשאה עודכנה!')
  }

  const roleCounts = Object.keys(ROLE_LABELS).reduce((acc, r) => {
    acc[r as UserRole] = users.filter(u => u.role === r).length
    return acc
  }, {} as Record<UserRole, number>)

  return (
    <div>
      <div style={S.ph}>
        <div>
          <div style={S.title}>ניהול משתמשים</div>
          <div style={S.sub}>{users.length} משתמשים · 3 רמות הרשאה</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnOutline} onClick={() => setShowMatrix(true)}>מטריצת הרשאות</button>
          <button style={S.btnGold} onClick={() => setShowInvite(true)}>+ הזמן משתמש</button>
        </div>
      </div>

      {/* Role summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 20 }}>
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
          <div key={role} style={{ background: '#FFFFFF', padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: '#7A756E', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
            <div style={{ fontFamily: 'serif', fontSize: 28, color: ROLE_COLORS[role] }}>{roleCounts[role] ?? 0}</div>
            <div style={{ marginTop: 8, height: 2, background: '#D8D4CE', borderRadius: 1 }}>
              <div style={{ height: '100%', width: `${((roleCounts[role] ?? 0) / Math.max(users.length, 1)) * 100}%`, background: ROLE_COLORS[role], borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 150px 140px 140px 80px', gap: 10, padding: '7px 16px', fontSize: 7, letterSpacing: 2.5, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
          <div /><div>משתמש</div><div>אימייל</div><div>הרשאה נוכחית</div><div>שנה הרשאה</div><div>פעולות</div>
        </div>
        {loading && <div style={S.empty}>טוען...</div>}
        {users.map(u => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 150px 140px 140px 80px', gap: 10, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8E5E0', border: `1px solid ${ROLE_COLORS[u.role ?? 'field_worker']}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontSize: 13, color: '#C9A84C' }}>
              {u.full_name?.[0] ?? '?'}
            </div>
            <div>
              <div style={{ fontSize: 12, color: u.id === user?.id ? '#C9A84C' : '#1A1714' }}>
                {u.full_name} {u.id === user?.id && <span style={{ fontSize: 8, color: '#7A756E' }}>(אתה)</span>}
              </div>
              <div style={{ fontSize: 9, color: '#7A756E', marginTop: 1 }}>
                {u.created_at ? `הצטרף ${new Date(u.created_at).toLocaleDateString('he-IL')}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#7A756E' }}>{u.email}</div>
            <div>
              <span style={{
                fontSize: 8, letterSpacing: 1.5, padding: '3px 10px',
                textTransform: 'uppercase' as const,
                color: ROLE_COLORS[u.role ?? 'field_worker'],
                border: `1px solid ${ROLE_COLORS[u.role ?? 'field_worker']}40`,
                background: `${ROLE_COLORS[u.role ?? 'field_worker']}12`,
              }}>
                {ROLE_LABELS[u.role ?? 'field_worker']}
              </span>
            </div>
            <div>
              {u.id !== user?.id ? (
                <select value={u.role ?? 'field_worker'} onChange={e => updateRole(u.id, e.target.value as UserRole)} style={{ background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '5px 8px', fontSize: 10, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', width: '100%' }}>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([r, l]) => (
                    <option key={r} value={r} style={{ background: '#FFFFFF' }}>{l}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: 10, color: '#A09890' }}>המשתמש שלך</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => setEditUser(u)} style={S.btnMini}>✎</button>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions matrix modal */}
      {showMatrix && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 1000, overflowY: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.2)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'serif', fontSize: 20, color: '#1A1714' }}>מטריצת הרשאות</div>
              <button onClick={() => setShowMatrix(false)} style={{ background: 'none', border: 'none', color: '#7A756E', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#7A756E', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)', width: 200 }}>הרשאה</th>
                    {(['admin','project_manager','field_worker'] as UserRole[]).map(r => (
                      <th key={r} style={{ padding: '8px 16px', color: ROLE_COLORS[r], fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(ROLE_PERMISSIONS.admin) as [string, boolean][]).map(([perm]) => {
                    const label = perm.replace(/_/g, ' ')
                    return (
                      <tr key={perm} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '7px 12px', color: '#1A1714', fontSize: 10 }}>{label}</td>
                        {(['admin','project_manager','field_worker'] as UserRole[]).map(r => {
                          const val = ROLE_PERMISSIONS[r][perm as keyof typeof ROLE_PERMISSIONS.admin]
                          return (
                            <td key={r} style={{ padding: '7px 16px', textAlign: 'center' }}>
                              {val
                                ? <span style={{ color: '#5C9967', fontSize: 14 }}>✓</span>
                                : <span style={{ color: '#D8D4CE', fontSize: 14 }}>—</span>
                              }
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvited={(u) => { setUsers(prev => [...prev, u]); toast.success('הזמנה נשלחה!') }} />
      )}

      {/* Edit user modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={(updates) => {
            setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u))
            setEditUser(null)
            toast.success('משתמש עודכן!')
          }}
        />
      )}
    </div>
  )
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (u: AppUser) => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('field_worker')
  const [sending, setSending] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    // In production: call Supabase Auth Admin API to invite user
    // Here we create a profile entry that will be linked when user signs up
    const { data, error } = await supabase.from('profiles').insert({
      email, full_name: name, role,
    }).select().single()
    setSending(false)
    if (error) { toast.error('שגיאה — ייתכן שהמייל כבר רשום'); return }
    if (data) onInvited({ ...data, role })
    onClose()
  }

  return (
    <Modal title="הזמן משתמש חדש" onClose={onClose}>
      <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FF label="שם מלא *" value={name} onChange={setName} required />
        <FF label="אימייל *" value={email} onChange={setEmail} type="email" required />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={S.fLbl}>רמת הרשאה</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['admin','project_manager','field_worker'] as UserRole[]).map(r => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${role === r ? ROLE_COLORS[r] + '40' : 'rgba(201,168,76,0.1)'}`, background: role === r ? `${ROLE_COLORS[r]}0A` : '#F0EDE8', cursor: 'pointer' }}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ accentColor: ROLE_COLORS[r] }} />
                <div>
                  <div style={{ fontSize: 12, color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</div>
                  <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>
                    {r === 'admin' && 'גישה מלאה — כל המודולים, כל הפרויקטים'}
                    {r === 'project_manager' && 'גישה לפרויקטים שלו — עובדים, חשבוניות, דוחות'}
                    {r === 'field_worker' && 'דיווח שעות + צפייה בפרויקט שלו בלבד'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ ...S.btnOutline, flex: 1 }}>ביטול</button>
          <button type="submit" disabled={sending} style={{ ...S.btnGold, flex: 2 }}>{sending ? 'שולח...' : '✉ שלח הזמנה'}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSave }: { user: AppUser; onClose: () => void; onSave: (u: Partial<AppUser>) => void }) {
  const [role, setRole] = useState<UserRole>(user.role)
  const [name, setName] = useState(user.full_name)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ role, full_name: name }).eq('id', user.id)
    setSaving(false)
    onSave({ role, full_name: name })
    onClose()
  }

  return (
    <Modal title={`עריכת משתמש — ${user.full_name}`} onClose={onClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FF label="שם מלא" value={name} onChange={setName} required />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={S.fLbl}>הרשאה</label>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} style={{ background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '9px 12px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
            {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([r, l]) => (
              <option key={r} value={r} style={{ background: '#FFFFFF' }}>{l}</option>
            ))}
          </select>
        </div>

        {/* Preview permissions */}
        <div style={{ padding: '12px', border: '1px solid rgba(201,168,76,0.1)', background: '#F0EDE8', maxHeight: 180, overflowY: 'auto' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: ROLE_COLORS[role], textTransform: 'uppercase', marginBottom: 8 }}>הרשאות — {ROLE_LABELS[role]}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.entries(ROLE_PERMISSIONS[role]) as [string, boolean][]).filter(([, v]) => v).map(([perm]) => (
              <span key={perm} style={{ fontSize: 8, padding: '2px 7px', background: `${ROLE_COLORS[role]}15`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}30`, letterSpacing: 0.5 }}>
                {perm.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...S.btnOutline, flex: 1 }}>ביטול</button>
          <button type="submit" disabled={saving} style={{ ...S.btnGold, flex: 2 }}>{saving ? 'שומר...' : 'שמור שינויים'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.2)', padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontFamily: 'serif', color: '#1A1714' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7A756E', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FF({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={S.fLbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} style={{ background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%', transition: '.2s' }} onFocus={e => e.target.style.borderColor = '#C9A84C'} onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.15)'} />
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  empty: { padding: 24, textAlign: 'center' as const, color: '#7A756E', fontSize: 11 },
  btnGold: { padding: '9px 18px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 14px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnMini: { padding: '4px 10px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit' },
  fLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E' },
}
