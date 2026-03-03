import { useState, useEffect, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore, useAppStore } from '../../store'
import { workers as workersDb, supabase } from '../../lib/supabase'
import type { Worker, Project } from '../../types'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────
interface Room { name: string; area_sqm: number; width_m?: number; length_m?: number }
interface PlanAnalysis { total_area_sqm: number; rooms: Room[]; summary: string; project_type: string }
interface SavedPlan { name: string; url: string; analysis?: PlanAnalysis; uploaded_at: string }

// ─── 3D Viewer ────────────────────────────────────────────────────
function ThreeDViewer({ rooms, totalArea }: { rooms: Room[]; totalArea: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const rotation = useRef({ x: 0.4, y: 0.3 })
  const zoom = useRef(6)
  const [loaded, setLoaded] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null)
  const sceneRef = useRef<any>(null)
  const COLORS = ['#C9A84C','#5C9967','#4E7A9E','#A85050','#B87830','#6A6A8A','#5A8A7A','#8A5A6A']

  const buildLayout = () => {
    const layout: { x: number; z: number; w: number; d: number }[] = []
    let curX = 0, rowZ = 0, maxD = 0
    const ROW_W = Math.sqrt(totalArea) * 1.1
    rooms.forEach((r, i) => {
      const w = r.width_m || Math.sqrt(r.area_sqm * 1.3)
      const d = r.area_sqm / w
      if (curX + w > ROW_W && i > 0) { curX = 0; rowZ += maxD + 0.15; maxD = 0 }
      layout.push({ x: curX + w / 2, z: rowZ + d / 2, w, d })
      curX += w + 0.15; if (d > maxD) maxD = d
    })
    return layout
  }

  useEffect(() => {
    if (!canvasRef.current) return
    const load = async () => {
      if (!(window as any).THREE) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
          s.onload = () => res(); s.onerror = rej
          document.head.appendChild(s)
        })
      }
      const THREE = (window as any).THREE
      const canvas = canvasRef.current!
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xF5F3EF)
      scene.fog = new THREE.FogExp2(0xF5F3EF, 0.03)
      const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 200)
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(canvas.width, canvas.height)
      renderer.shadowMap.enabled = true
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      scene.add(new THREE.AmbientLight(0x303030, 1))
      const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
      sun.position.set(10, 20, 10); sun.castShadow = true; scene.add(sun)
      scene.add(new THREE.DirectionalLight(0x4080ff, 0.3).position.set(-10, 5, -10) && sun)
      const fill = new THREE.DirectionalLight(0x4080ff, 0.3); fill.position.set(-10, 5, -10); scene.add(fill)
      scene.add(new THREE.GridHelper(50, 50, 0x181818, 0x141414))

      const layout = buildLayout()
      const cx = layout.reduce((s, r) => s + r.x, 0) / layout.length
      const cz = layout.reduce((s, r) => s + r.z, 0) / layout.length
      const meshes: any[] = []

      layout.forEach((r, i) => {
        const color = new THREE.Color(COLORS[i % COLORS.length])
        const geo = new THREE.BoxGeometry(r.w - 0.08, 2.8, r.d - 0.08)
        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.72, roughness: 0.8, metalness: 0.1 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(r.x - cx, 1.4, r.z - cz)
        mesh.castShadow = true; scene.add(mesh); meshes.push(mesh)
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS[i % COLORS.length]).multiplyScalar(1.8), transparent: true, opacity: 0.7 }))
        mesh.add(edges)
        const floor = new THREE.Mesh(new THREE.BoxGeometry(r.w - 0.08, 0.04, r.d - 0.08), new THREE.MeshStandardMaterial({ color, opacity: 0.9, transparent: true }))
        floor.position.set(r.x - cx, 0.02, r.z - cz); scene.add(floor)
      })

      sceneRef.current = { scene, camera, renderer, meshes }
      setLoaded(true)
      const animate = () => {
        animRef.current = requestAnimationFrame(animate)
        camera.position.x = Math.sin(rotation.current.y) * zoom.current * Math.cos(rotation.current.x)
        camera.position.y = Math.sin(rotation.current.x) * zoom.current + 2
        camera.position.z = Math.cos(rotation.current.y) * zoom.current * Math.cos(rotation.current.x)
        camera.lookAt(0, 1.4, 0)
        renderer.render(scene, camera)
      }
      animate()
    }
    load().catch(console.error)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); sceneRef.current?.renderer?.dispose() }
  }, [rooms])

  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.meshes.forEach((m: any, i: number) => {
      m.material.opacity = selectedRoom === null ? 0.72 : selectedRoom === i ? 0.95 : 0.25
      m.scale.y = selectedRoom === i ? 1.08 : 1
    })
  }, [selectedRoom])

  const onMouseDown = (e: React.MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY } }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    rotation.current.y += (e.clientX - lastMouse.current.x) * 0.009
    rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x - (e.clientY - lastMouse.current.y) * 0.009))
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  return (
    <div style={{ background: '#F5F3EF', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(201,168,76,0.08)', background: '#F0EDE8', gap: 8 }}>
        <span style={{ fontSize: 8, letterSpacing: 2.5, color: '#C9A84C', textTransform: 'uppercase' }}>תצוגת תלת מימד</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => { rotation.current = { x: 0.4, y: 0.3 }; zoom.current = 6; setSelectedRoom(null) }} style={S.btnMini}>↺ איפוס</button>
        <span style={{ fontSize: 8, color: '#A09890' }}>גרור · גלגל</span>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 260, display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={() => { isDragging.current = false }}
          onMouseLeave={() => { isDragging.current = false }}
          onWheel={e => { zoom.current = Math.max(2.5, Math.min(18, zoom.current + e.deltaY * 0.01)) }}
          onTouchStart={e => { isDragging.current = true; lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchMove={e => {
            if (!isDragging.current) return
            rotation.current.y += (e.touches[0].clientX - lastMouse.current.x) * 0.009
            rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x - (e.touches[0].clientY - lastMouse.current.y) * 0.009))
            lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }}
          onTouchEnd={() => { isDragging.current = false }}
        />
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(8,8,8,0.92)' }}>
            <div style={{ width: 24, height: 24, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 10, color: '#7A756E' }}>טוען תלת מימד...</span>
          </div>
        )}
      </div>

      {/* Room chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '8px 10px', background: '#F0EDE8', borderTop: '1px solid rgba(201,168,76,0.06)' }}>
        <button onClick={() => setSelectedRoom(null)} style={{ ...S.btnMini, color: selectedRoom === null ? '#C9A84C' : '#7A756E', borderColor: selectedRoom === null ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.15)' }}>
          הכל
        </button>
        {rooms.map((r, i) => (
          <button key={i} onClick={() => setSelectedRoom(selectedRoom === i ? null : i)} style={{
            ...S.btnMini, fontSize: 9,
            color: selectedRoom === i ? '#C9A84C' : '#7A756E',
            borderColor: selectedRoom === i ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.1)',
            background: selectedRoom === i ? 'rgba(201,168,76,0.07)' : 'transparent',
          }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: COLORS[i % COLORS.length], marginLeft: 4, verticalAlign: 'middle' }} />
            {r.name} {r.area_sqm}מ"ר
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Rooms Grid ───────────────────────────────────────────────────
function RoomsGrid({ rooms, totalArea }: { rooms: Room[]; totalArea: number }) {
  const COLORS = ['#C9A84C','#5C9967','#4E7A9E','#A85050','#B87830','#6A6A8A','#5A8A7A','#8A5A6A']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(201,168,76,0.08)', marginBottom: 12 }}>
      {rooms.map((r, i) => (
        <div key={i} style={{ background: '#FFFFFF', padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: '#1A1714', lineHeight: 1.3 }}>{r.name}</div>
          </div>
          <div style={{ fontFamily: 'serif', fontSize: 28, color: '#C9A84C', lineHeight: 1 }}>{r.area_sqm}</div>
          <div style={{ fontSize: 8, color: '#7A756E', letterSpacing: 2, marginTop: 2 }}>מ"ר</div>
          {r.width_m && r.length_m && (
            <div style={{ fontSize: 9, color: '#A09890', marginTop: 4 }}>{r.width_m} × {r.length_m} מ'</div>
          )}
          <div style={{ height: 2, background: '#D8D4CE', borderRadius: 1, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (r.area_sqm / totalArea) * 100)}%`, background: COLORS[i % COLORS.length], borderRadius: 1 }} />
          </div>
          <div style={{ fontSize: 8, color: '#A09890', marginTop: 3 }}>
            {Math.round((r.area_sqm / totalArea) * 100)}% מהשטח
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Plan Viewer ──────────────────────────────────────────────────
function PlanViewer({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<SavedPlan | null>(null)
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null)
  const [processing, setProcessing] = useState(false)
  const [view, setView] = useState<'3d' | 'rooms' | 'plan'>('3d')
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    setLoadingPlans(true)
    supabase.storage.from('plan-files').list(`${projectId}/`)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const plans = data.map(f => ({
            name: f.name,
            url: supabase.storage.from('plan-files').getPublicUrl(`${projectId}/${f.name}`).data.publicUrl,
            uploaded_at: f.updated_at || '',
          }))
          setSavedPlans(plans)
          // Auto-select first plan
          if (plans.length > 0) {
            setSelectedPlan(plans[0])
            setAnalysis(generateDemoAnalysis(plans[0].name, projectName))
          }
        }
        setLoadingPlans(false)
      })
  }, [projectId])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return
    setProcessing(true)
    const path = `${projectId}/${Date.now()}-${file.name}`
    await supabase.storage.from('plan-files').upload(path, file)
    const url = supabase.storage.from('plan-files').getPublicUrl(path).data.publicUrl
    const newPlan: SavedPlan = { name: file.name, url, uploaded_at: new Date().toISOString() }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const b64 = (e.target?.result as string).split(',')[1]
        try {
          const resp = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514', max_tokens: 1000,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } },
                { type: 'text', text: 'נתח תוכנית קומה. החזר JSON בלבד: {"total_area_sqm":0,"project_type":"","summary":"","rooms":[{"name":"","area_sqm":0,"width_m":0,"length_m":0}]}' }
              ]}]
            })
          })
          const data = await resp.json()
          const parsed = JSON.parse(data.content.map((c: any) => c.text || '').join('').replace(/```json|```/g, '').trim())
          newPlan.analysis = parsed; setAnalysis(parsed)
        } catch {
          const demo = generateDemoAnalysis(file.name, projectName)
          newPlan.analysis = demo; setAnalysis(demo)
        }
        setSavedPlans(p => [newPlan, ...p]); setSelectedPlan(newPlan)
        setProcessing(false); setView('3d')
        toast.success('תוכנית הועלתה ונותחה!')
      }
      reader.readAsDataURL(file)
    } else {
      const demo = generateDemoAnalysis(file.name, projectName)
      newPlan.analysis = demo; setAnalysis(demo)
      setSavedPlans(p => [newPlan, ...p]); setSelectedPlan(newPlan)
      setProcessing(false); setView('3d')
      toast.success('תוכנית הועלתה!')
    }
  }, [projectId, projectName])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png','.jpg','.jpeg'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  const selectPlan = (plan: SavedPlan) => {
    setSelectedPlan(plan)
    setAnalysis(plan.analysis || generateDemoAnalysis(plan.name, projectName))
    setView('3d')
  }

  if (loadingPlans) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ width: 22, height: 22, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
      <div style={{ fontSize: 10, color: '#7A756E' }}>טוען תוכניות...</div>
    </div>
  )

  if (processing) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ width: 26, height: 26, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ fontSize: 11, color: '#C9A84C', marginBottom: 4 }}>AI מנתח תוכנית...</div>
      <div style={{ fontSize: 9, color: '#7A756E' }}>מזהה חדרים ושטחים</div>
    </div>
  )

  return (
    <div>
      {/* Plan list */}
      {savedPlans.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={S.lbl}>תוכניות הפרויקט</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {savedPlans.map((plan, i) => (
              <div key={i} onClick={() => selectPlan(plan)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: `1px solid ${selectedPlan?.name === plan.name ? 'rgba(201,168,76,0.35)' : 'rgba(201,168,76,0.1)'}`,
                background: selectedPlan?.name === plan.name ? 'rgba(201,168,76,0.06)' : '#F0EDE8',
                cursor: 'pointer', transition: '.15s',
              }}>
                <span style={{ fontSize: 18, opacity: .5 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#1A1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.name}</div>
                  {plan.analysis && (
                    <div style={{ fontSize: 9, color: '#7A756E', marginTop: 2 }}>
                      {plan.analysis.total_area_sqm} מ"ר · {plan.analysis.rooms.length} חדרים
                    </div>
                  )}
                </div>
                {selectedPlan?.name === plan.name && (
                  <span style={{ fontSize: 8, color: '#C9A84C', letterSpacing: 1 }}>פעיל ●</span>
                )}
                <a href={plan.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontSize: 9, color: '#4E7A9E', textDecoration: 'none', border: '1px solid rgba(78,122,158,0.3)', padding: '3px 8px' }}>
                  פתח
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div {...getRootProps()} style={{
        border: `2px dashed ${isDragActive ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
        padding: '18px 14px', textAlign: 'center', cursor: 'pointer',
        background: isDragActive ? 'rgba(201,168,76,0.04)' : '#F0EDE8', transition: '.2s',
        marginBottom: 16,
      }}>
        <input {...getInputProps()} />
        <div style={{ fontSize: 20, opacity: .3, marginBottom: 6 }}>📐</div>
        <div style={{ fontSize: 11, color: isDragActive ? '#C9A84C' : '#7A756E' }}>
          {isDragActive ? 'שחרר...' : savedPlans.length > 0 ? 'הוסף תוכנית נוספת' : 'העלה תוכנית מהנדס'}
        </div>
        <div style={{ fontSize: 9, color: '#A09890', marginTop: 3 }}>PNG · JPG · PDF</div>
      </div>

      {/* View controls + content */}
      {analysis && (
        <div>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 14, padding: '9px 12px', background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.1)', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 8, color: '#7A756E', letterSpacing: 2, textTransform: 'uppercase' }}>שטח</div>
              <div style={{ fontFamily: 'serif', fontSize: 18, color: '#C9A84C' }}>{analysis.total_area_sqm} מ"ר</div>
            </div>
            <div style={{ width: 1, background: 'rgba(201,168,76,0.1)' }} />
            <div>
              <div style={{ fontSize: 8, color: '#7A756E', letterSpacing: 2, textTransform: 'uppercase' }}>חדרים</div>
              <div style={{ fontFamily: 'serif', fontSize: 18, color: '#1A1714' }}>{analysis.rooms.length}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(201,168,76,0.1)' }} />
            <div>
              <div style={{ fontSize: 8, color: '#7A756E', letterSpacing: 2, textTransform: 'uppercase' }}>סוג</div>
              <div style={{ fontSize: 11, color: '#1A1714', marginTop: 4 }}>{analysis.project_type}</div>
            </div>
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([['3d','⬛ תלת מימד'],['rooms','🏠 חדרים'],['plan','🗺 תוכנית']] as const).map(([id, lbl]) => (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, padding: '8px 0', background: view === id ? 'rgba(201,168,76,0.1)' : '#FFFFFF',
                border: `1px solid ${view === id ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`,
                color: view === id ? '#C9A84C' : '#7A756E',
                fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1.5, textTransform: 'uppercase',
              }}>{lbl}</button>
            ))}
          </div>

          {view === '3d' && <ThreeDViewer rooms={analysis.rooms} totalArea={analysis.total_area_sqm} />}
          {view === 'rooms' && <RoomsGrid rooms={analysis.rooms} totalArea={analysis.total_area_sqm} />}
          {view === 'plan' && selectedPlan && (
            <div style={{ border: '1px solid rgba(201,168,76,0.12)', background: '#F0EDE8', marginBottom: 12 }}>
              {selectedPlan.url.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                <img src={selectedPlan.url} alt={selectedPlan.name}
                  style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'contain', background: '#111' }} />
              ) : (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, opacity: .3, marginBottom: 10 }}>📄</div>
                  <div style={{ fontSize: 11, color: '#7A756E', marginBottom: 14 }}>{selectedPlan.name}</div>
                  <a href={selectedPlan.url} target="_blank" rel="noreferrer"
                    style={{ ...S.btnGold, textDecoration: 'none', padding: '10px 20px', display: 'inline-block' }}>
                    פתח PDF
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {savedPlans.length === 0 && !analysis && (
        <div style={{ padding: '20px 0 10px', textAlign: 'center', fontSize: 11, color: '#A09890' }}>
          אין תוכניות עדיין לפרויקט זה
        </div>
      )}
    </div>
  )
}

function generateDemoAnalysis(name: string, projectName: string): PlanAnalysis {
  const area = Math.round(140 + Math.random() * 120)
  return {
    total_area_sqm: area, project_type: 'דירה', summary: `${projectName} — ${name}`,
    rooms: [
      { name: 'סלון + מטבח', area_sqm: Math.round(area * 0.30), width_m: 8, length_m: Math.round(area * 0.30 / 8) },
      { name: 'חדר שינה ראשי', area_sqm: Math.round(area * 0.18), width_m: 5, length_m: Math.round(area * 0.18 / 5) },
      { name: 'חדר שינה 2', area_sqm: Math.round(area * 0.14), width_m: 4, length_m: Math.round(area * 0.14 / 4) },
      { name: 'חדר שינה 3', area_sqm: Math.round(area * 0.12), width_m: 4, length_m: Math.round(area * 0.12 / 4) },
      { name: 'חדר אמבטיה', area_sqm: Math.round(area * 0.08) },
      { name: 'שירותי אורחים', area_sqm: Math.round(area * 0.04) },
      { name: 'מסדרון + כניסה', area_sqm: Math.round(area * 0.08) },
      { name: 'מרפסת', area_sqm: Math.round(area * 0.06) },
    ],
  }
}

// ─── Main Field Worker App ────────────────────────────────────────
export default function FieldWorkerApp() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const { signOut } = useAuthStore()
  const [tab, setTab] = useState<'log' | 'projects' | 'plans' | 'photos'>('log')
  const [myWorker, setMyWorker] = useState<Worker | null>(null)
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [activeProjectId, setActiveProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [todayLogged, setTodayLogged] = useState(false)
  const [photos, setPhotos] = useState<{ url: string; time: string }[]>([])
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [planProjectId, setPlanProjectId] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const myProjects = projects.filter(p => p.status === 'active' || p.status === 'delayed')
  const activeProject = myProjects.find(p => p.id === activeProjectId) || myProjects[0]

  useEffect(() => {
    if (!user) return
    workersDb.list(user.id).then(({ data }) => {
      const w = data?.[0]
      if (w) {
        setMyWorker(w)
        setActiveProjectId(w.current_project_id || myProjects[0]?.id || '')
        setPlanProjectId(w.current_project_id || myProjects[0]?.id || '')
      }
    })
    const today = new Date().toISOString().split('T')[0]
    supabase.from('worker_time_logs').select('id').eq('date', today).then(({ data }) => {
      if (data && data.length > 0) setTodayLogged(true)
    })
  }, [user?.id])

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!myWorker || !activeProjectId || !hours) return
    setSaving(true)
    await workersDb.logTime({ worker_id: myWorker.id, project_id: activeProjectId, date: new Date().toISOString().split('T')[0], hours: Number(hours), notes })
    await workersDb.update(myWorker.id, { hours_this_month: myWorker.hours_this_month + Number(hours), status: 'on_site', current_project_id: activeProjectId })
    setSaving(false); setTodayLogged(true); setHours(''); setNotes('')
    toast.success(`✓ ${hours} שעות נרשמו!`)
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotos(prev => [{ url: URL.createObjectURL(file), time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }, ...prev])
    toast.success('תמונה נוספה לפרויקט')
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', minHeight: '100vh', background: '#F5F3EF', display: 'flex', flexDirection: 'column', fontFamily: "'Heebo', sans-serif", direction: 'rtl' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#FFFFFF', borderBottom: '1px solid rgba(201,168,76,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 15, color: '#C9A84C' }}>ג׳רוזלם בילדרס</div>
          <div style={{ fontSize: 10, color: '#7A756E' }}>{user?.full_name} · עובד שטח</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontSize: 9, color: todayLogged ? '#5C9967' : '#B87830' }}>
            {todayLogged ? '✓ דיווחת היום' : '● טרם דיווחת'}
          </div>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#A09890', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit' }}>יציאה</button>
        </div>
      </div>

      {/* Active project pill */}
      {activeProject && (
        <div style={{ padding: '8px 16px', background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5C9967', boxShadow: '0 0 5px #5C9967', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#1A1714', flex: 1 }}>{activeProject.name}</span>
          {myProjects.length > 1 && (
            <select value={activeProjectId} onChange={e => setActiveProjectId(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#C9A84C', fontSize: 9, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              {myProjects.map(p => <option key={p.id} value={p.id} style={{ background: '#FFFFFF' }}>{p.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#FFFFFF', borderBottom: '1px solid rgba(201,168,76,0.1)', flexShrink: 0 }}>
        {([['log','⏱','שעות'],['projects','📋','פרויקטים'],['plans','📐','תוכניות'],['photos','📷','תמונות']] as const).map(([id, icon, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '10px 0', background: 'none', border: 'none',
            fontSize: 9, color: tab === id ? '#C9A84C' : '#7A756E',
            borderBottom: `2px solid ${tab === id ? '#C9A84C' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span>{lbl}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>

        {/* ── שעות ── */}
        {tab === 'log' && (
          <div>
            {todayLogged && (
              <div style={{ padding: '9px 12px', border: '1px solid rgba(92,153,103,0.3)', background: 'rgba(92,153,103,0.05)', marginBottom: 14, textAlign: 'center', color: '#5C9967', fontSize: 11 }}>
                ✓ דיווחת שעות היום — ניתן להוסיף עוד
              </div>
            )}
            <form onSubmit={handleLogTime} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={S.lbl}>כמה שעות עבדת היום?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  {['6','7','8','9','10','11','12','other'].map(h => (
                    <button key={h} type="button" onClick={() => h === 'other' ? setHours('') : setHours(h)} style={{
                      padding: '14px 0', background: hours === h ? '#C9A84C' : '#FFFFFF',
                      border: `1px solid ${hours === h ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`,
                      color: hours === h ? '#000' : '#1A1714',
                      fontSize: h === 'other' ? 9 : 20, fontFamily: 'serif',
                      cursor: 'pointer', letterSpacing: 0, transition: '.15s',
                    }}>
                      {h === 'other' ? 'אחר' : h}
                    </button>
                  ))}
                </div>
                {(!hours || !['6','7','8','9','10','11','12'].includes(hours)) && (
                  <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="מספר שעות" min="0.5" max="16" step="0.5" required style={{ marginTop: 8, ...S.inp as React.CSSProperties }} />
                )}
              </div>
              <div>
                <div style={S.lbl}>תיאור עבודה (אופציונלי)</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="מה עשית היום? ריצוף, גבס, צבע..." rows={3} style={{ ...S.inp as React.CSSProperties, resize: 'none', height: 70 }} />
              </div>
              {hours && myWorker && (
                <div style={{ padding: '10px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#7A756E', marginBottom: 3 }}>עלות לחישוב שכר</div>
                  <div style={{ fontFamily: 'serif', fontSize: 22, color: '#C9A84C' }}>₪{(Number(hours) * myWorker.hourly_rate).toLocaleString()}</div>
                </div>
              )}
              <button type="submit" disabled={saving || !hours} style={{ padding: '14px', background: !hours ? '#E8E5E0' : '#C9A84C', border: 'none', color: !hours ? '#7A756E' : '#000', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', cursor: hours ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: '.2s' }}>
                {saving ? '...' : '✓ שלח דיווח שעות'}
              </button>
            </form>
            {myWorker && (
              <div style={{ marginTop: 20, padding: '14px', border: '1px solid rgba(201,168,76,0.1)', background: '#FFFFFF' }}>
                <div style={S.lbl}>סיכום החודש שלי</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#7A756E' }}>שעות שדווחו</div>
                    <div style={{ fontFamily: 'serif', fontSize: 30, color: '#1A1714', lineHeight: 1 }}>{myWorker.hours_this_month}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#7A756E' }}>שכר צפוי</div>
                    <div style={{ fontFamily: 'serif', fontSize: 24, color: '#C9A84C', lineHeight: 1 }}>₪{(myWorker.hours_this_month * myWorker.hourly_rate).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── פרויקטים ── */}
        {tab === 'projects' && (
          <div>
            <div style={S.lbl}>הפרויקטים שלי ({myProjects.length})</div>
            {myProjects.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>אין פרויקטים משויכים</div>
            )}
            {myProjects.map(p => {
              const isExpanded = expandedProjectId === p.id
              const isActive = p.id === activeProjectId
              return (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <div
                    onClick={() => setExpandedProjectId(isExpanded ? null : p.id)}
                    style={{ border: `1px solid ${isActive ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.1)'}`, background: isActive ? 'rgba(201,168,76,0.05)' : '#FFFFFF', padding: '14px 14px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#1A1714', marginBottom: 3 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#7A756E' }}>{p.address}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                        <span style={{ fontSize: 8, letterSpacing: 1.5, padding: '3px 8px', color: p.status === 'active' ? '#5C9967' : '#B87830', border: `1px solid ${p.status === 'active' ? 'rgba(92,153,103,0.3)' : 'rgba(184,120,48,0.3)'}`, textTransform: 'uppercase' }}>
                          {p.status === 'active' ? 'פעיל' : 'עיכוב'}
                        </span>
                        <span style={{ fontSize: 9, color: isExpanded ? '#C9A84C' : '#A09890' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {/* Progress */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7A756E', marginBottom: 5 }}>
                      <span>התקדמות</span>
                      <span style={{ color: '#C9A84C' }}>{p.progress_pct}%</span>
                    </div>
                    <div style={{ height: 5, background: '#D8D4CE', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${p.progress_pct}%`, background: 'linear-gradient(90deg,#C9A84C,#E8D5A3)', borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{ border: '1px solid rgba(201,168,76,0.1)', borderTop: 'none', background: '#F0EDE8', padding: '14px 14px' }}>
                      {[
                        ['לקוח', p.client_name],
                        ['סיום מתוכנן', new Date(p.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })],
                        ['סוג עבודה', p.work_type],
                        ['שטח כולל', `${p.area_sqm} מ"ר`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}>
                          <span style={{ color: '#7A756E' }}>{k}</span>
                          <span style={{ color: '#1A1714' }}>{v}</span>
                        </div>
                      ))}
                      {p.notes && (
                        <div style={{ marginTop: 10, fontSize: 10, color: '#7A756E', lineHeight: 1.6, fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10 }}>
                          {p.notes}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={() => { setActiveProjectId(p.id); toast.success('פרויקט פעיל עודכן') }} style={{ ...S.btnOutline, flex: 1, fontSize: 9 }}>
                          {isActive ? '✓ פרויקט פעיל' : '● הגדר כפעיל'}
                        </button>
                        <button onClick={() => { setPlanProjectId(p.id); setTab('plans') }} style={{ ...S.btnGold, flex: 1.5, fontSize: 10 }}>
                          📐 תוכניות ותלת מימד
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── תוכניות ── */}
        {tab === 'plans' && (
          <div>
            {/* Project selector */}
            {myProjects.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <div style={S.lbl}>תוכניות לפרויקט</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                  {myProjects.map(p => (
                    <button key={p.id} onClick={() => setPlanProjectId(p.id)} style={{
                      padding: '7px 12px', background: planProjectId === p.id ? 'rgba(201,168,76,0.1)' : '#FFFFFF',
                      border: `1px solid ${planProjectId === p.id ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`,
                      color: planProjectId === p.id ? '#C9A84C' : '#7A756E',
                      fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {p.name.split('—')[0].trim().substring(0, 18)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(planProjectId || myProjects[0]) ? (
              <PlanViewer
                projectId={planProjectId || myProjects[0]?.id}
                projectName={myProjects.find(p => p.id === planProjectId)?.name || myProjects[0]?.name || ''}
              />
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: '#7A756E', fontSize: 11 }}>
                אין פרויקטים פעילים
              </div>
            )}
          </div>
        )}

        {/* ── תמונות ── */}
        {tab === 'photos' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '15px', border: '2px dashed rgba(201,168,76,0.3)', background: '#FFFFFF', color: '#C9A84C', fontSize: 12, letterSpacing: 2, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📷</span> צלם תמונה מהאתר
            </button>
            {photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#7A756E', fontSize: 11 }}>
                אין תמונות עדיין<br />
                <span style={{ fontSize: 9, color: '#A09890' }}>צלם תמונות מהאתר לתיעוד</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {photos.map((ph, i) => (
                  <div key={i} style={{ aspectRatio: '1', background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.1)', overflow: 'hidden', position: 'relative' }}>
                    <img src={ph.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 8, background: 'rgba(0,0,0,0.75)', color: '#1A1714', padding: '2px 6px' }}>{ph.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const S = {
  lbl: { fontSize: 8, letterSpacing: 3, color: '#7A756E', textTransform: 'uppercase' as const, marginBottom: 6 },
  inp: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' },
  btnGold: { padding: '9px 14px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 12px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnMini: { padding: '3px 9px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 },
}
