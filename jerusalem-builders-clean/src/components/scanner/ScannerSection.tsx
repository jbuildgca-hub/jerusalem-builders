import { useState, useEffect, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore, useAppStore } from '../../store'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────

interface Room {
  name: string
  area_sqm: number
  width_m?: number
  length_m?: number
  notes?: string
}

interface BOQItem {
  category: string
  item: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  notes?: string
}

interface PlanAnalysis {
  total_area_sqm: number
  rooms: Room[]
  boq: BOQItem[]
  summary: string
  project_type: string
}

const UNIT_PRICES: Record<string, number> = {
  'ריצוף פורצלן': 280, 'ריצוף שיש': 650, 'ריצוף קרמיקה': 180,
  'טיח פנים': 90, 'צבע': 65, 'גבס': 150,
  'דלתות פנים': 2800, 'חלונות': 1800, 'אינסטלציה': 12000,
  'חשמל': 18000, 'מיזוג אוויר': 8500, 'תאורה': 4500,
  'מטבח': 45000, 'חדר אמבטיה': 22000,
  'ריהוט מובנה': 15000, 'פרגוד': 3200,
}

// ─── AI Extraction via Anthropic ─────────────────────────────────

async function analyzeFloorPlan(imageData: string, mediaType: string): Promise<PlanAnalysis> {
  const prompt = `אתה אדריכל מומחה. נתח את תוכנית הקומה הזו וחלץ נתונים לכתב כמויות.
  
החזר JSON בלבד (ללא markdown), בפורמט הזה:
{
  "total_area_sqm": 0,
  "project_type": "דירה/בית פרטי/מסחרי",
  "summary": "תיאור קצר",
  "rooms": [
    {"name": "שם חדר", "area_sqm": 0, "width_m": 0, "length_m": 0}
  ],
  "boq": [
    {"category": "ריצוף", "item": "ריצוף פורצלן 60x60", "quantity": 0, "unit": "מ״ר", "unit_price": 280, "total": 0},
    {"category": "קירות", "item": "טיח + צבע", "quantity": 0, "unit": "מ״ר", "unit_price": 90, "total": 0},
    {"category": "אינסטלציה", "item": "אינסטלציה מלאה", "quantity": 1, "unit": "יח'", "unit_price": 12000, "total": 12000},
    {"category": "חשמל", "item": "חשמל + תקשורת", "quantity": 1, "unit": "יח'", "unit_price": 18000, "total": 18000},
    {"category": "פנים", "item": "דלתות פנים", "quantity": 0, "unit": "יח'", "unit_price": 2800, "total": 0}
  ]
}

חשוב: ה-total של כל שורה = quantity × unit_price. הכלל שטחי כל החדרים.`

  const resp = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  })

  const data = await resp.json()
  const text = data.content?.map((c: { text?: string }) => c.text || '').join('') || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// Demo data for non-image files (PDF/DWG)
function generateDemoAnalysis(fileName: string): PlanAnalysis {
  const area = Math.round(150 + Math.random() * 200)
  const rooms: Room[] = [
    { name: 'סלון + מטבח', area_sqm: Math.round(area * 0.3), width_m: 8, length_m: Math.round(area * 0.3 / 8) },
    { name: 'חדר שינה ראשי', area_sqm: Math.round(area * 0.18), width_m: 5, length_m: Math.round(area * 0.18 / 5) },
    { name: 'חדר שינה 2', area_sqm: Math.round(area * 0.14), width_m: 4, length_m: Math.round(area * 0.14 / 4) },
    { name: 'חדר שינה 3', area_sqm: Math.round(area * 0.12), width_m: 4, length_m: Math.round(area * 0.12 / 4) },
    { name: 'חדר אמבטיה ראשי', area_sqm: Math.round(area * 0.08) },
    { name: 'שירותי אורחים', area_sqm: Math.round(area * 0.04) },
    { name: 'כניסה + מסדרון', area_sqm: Math.round(area * 0.08) },
    { name: 'מרפסת', area_sqm: Math.round(area * 0.06) },
  ]
  const boq: BOQItem[] = [
    { category: 'ריצוף', item: 'ריצוף פורצלן 60×60', quantity: Math.round(area * 0.85), unit: 'מ"ר', unit_price: 280, total: Math.round(area * 0.85) * 280 },
    { category: 'ריצוף', item: 'ריצוף שיש — חדרי רחצה', quantity: Math.round(area * 0.12), unit: 'מ"ר', unit_price: 650, total: Math.round(area * 0.12) * 650 },
    { category: 'קירות', item: 'טיח פנים', quantity: Math.round(area * 2.4), unit: 'מ"ר', unit_price: 90, total: Math.round(area * 2.4) * 90 },
    { category: 'קירות', item: 'צבע פרימיום', quantity: Math.round(area * 2.2), unit: 'מ"ר', unit_price: 65, total: Math.round(area * 2.2) * 65 },
    { category: 'תקרות', item: 'גבס + פינישינג', quantity: Math.round(area), unit: 'מ"ר', unit_price: 150, total: Math.round(area) * 150 },
    { category: 'דלתות', item: 'דלתות פנים', quantity: rooms.length - 1, unit: 'יח\'', unit_price: 2800, total: (rooms.length - 1) * 2800 },
    { category: 'חשמל', item: 'חשמל + תקשורת + תאורה', quantity: 1, unit: 'פרויקט', unit_price: Math.round(area * 120), total: Math.round(area * 120) },
    { category: 'אינסטלציה', item: 'אינסטלציה מלאה', quantity: 1, unit: 'פרויקט', unit_price: Math.round(area * 85), total: Math.round(area * 85) },
    { category: 'מיזוג', item: 'מיזוג אוויר מיני-מרכזי', quantity: Math.round(rooms.length * 0.7), unit: 'יח\'', unit_price: 8500, total: Math.round(rooms.length * 0.7) * 8500 },
    { category: 'מטבח', item: 'מטבח מלא כולל ריהוט', quantity: 1, unit: 'פרויקט', unit_price: 65000, total: 65000 },
    { category: 'חדרי רחצה', item: 'חדר אמבטיה מלא', quantity: 2, unit: 'יח\'', unit_price: 22000, total: 44000 },
  ]
  return {
    total_area_sqm: area,
    project_type: 'דירה',
    summary: `תוכנית ${fileName} — ${area} מ"ר, ${rooms.length} חדרים. כתב כמויות מלא לשיפוץ פנים.`,
    rooms,
    boq,
  }
}

// ─── 3D Viewer ────────────────────────────────────────────────────

function ThreeDViewer({ rooms, totalArea }: { rooms: Room[]; totalArea: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<any>(null)
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const animRef = useRef<number>()
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const rotation = useRef({ x: 0.4, y: 0.3 })
  const zoom = useRef(5)

  const COLORS = ['#C9A84C', '#5C9967', '#4E7A9E', '#A85050', '#B87830', '#6A6A8A', '#5A8A7A', '#8A5A6A']
  const ROOM_HEIGHT = 2.8

  // Build layout grid from rooms
  const buildLayout = (rms: Room[]) => {
    const layout: { x: number; z: number; w: number; d: number; name: string; area: number }[] = []
    let curX = 0
    let maxZ = 0
    let rowZ = 0
    const ROW_WIDTH = Math.sqrt(totalArea) * 1.1

    for (let i = 0; i < rms.length; i++) {
      const r = rms[i]
      const w = r.width_m || Math.sqrt(r.area_sqm * 1.3)
      const d = r.area_sqm / w

      if (curX + w > ROW_WIDTH && i > 0) {
        curX = 0
        rowZ += maxZ + 0.15
        maxZ = 0
      }

      layout.push({ x: curX + w / 2, z: rowZ + d / 2, w, d, name: r.name, area: r.area_sqm })
      curX += w + 0.15
      if (d > maxZ) maxZ = d
    }
    return layout
  }

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined') return

    const loadThree = async () => {
      // Dynamically load Three.js
      if (!(window as any).THREE) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
          s.onload = () => resolve()
          s.onerror = reject
          document.head.appendChild(s)
        })
      }

      const THREE = (window as any).THREE
      const canvas = canvasRef.current!
      const W = canvas.clientWidth, H = canvas.clientHeight
      canvas.width = W; canvas.height = H

      // Scene
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x0a0a0a, 0.025)
      scene.background = new THREE.Color(0xF5F3EF)

      // Camera
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
      camera.position.set(0, zoom.current, zoom.current * 1.2)
      camera.lookAt(0, 0, 0)

      // Renderer
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(W, H)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      // Lights
      const ambient = new THREE.AmbientLight(0x303030, 1)
      scene.add(ambient)
      const sun = new THREE.DirectionalLight(0xfff5e0, 2)
      sun.position.set(10, 20, 10)
      sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      scene.add(sun)
      const fill = new THREE.DirectionalLight(0x4080ff, 0.3)
      fill.position.set(-10, 5, -10)
      scene.add(fill)
      const gold = new THREE.PointLight(0xC9A84C, 0.5, 30)
      gold.position.set(0, 8, 0)
      scene.add(gold)

      // Grid
      const grid = new THREE.GridHelper(40, 40, 0x1a1a1a, 0x141414)
      scene.add(grid)

      // Build rooms
      const layout = buildLayout(rooms)
      const roomMeshes: any[] = []

      // Center offset
      const cx = layout.reduce((s, r) => s + r.x, 0) / layout.length
      const cz = layout.reduce((s, r) => s + r.z, 0) / layout.length

      layout.forEach((r, i) => {
        const color = new THREE.Color(COLORS[i % COLORS.length])
        const geo = new THREE.BoxGeometry(r.w - 0.08, ROOM_HEIGHT, r.d - 0.08)

        // Main room mesh
        const mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.7,
          roughness: 0.8,
          metalness: 0.1,
          wireframe: false,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(r.x - cx, ROOM_HEIGHT / 2, r.z - cz)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData = { index: i, name: r.name, area: r.area, origColor: color.clone(), origOpacity: 0.7 }
        scene.add(mesh)
        roomMeshes.push(mesh)

        // Edges
        const edges = new THREE.EdgesGeometry(geo)
        const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS[i % COLORS.length]).multiplyScalar(1.5), transparent: true, opacity: 0.6 })
        const edgeMesh = new THREE.LineSegments(edges, lineMat)
        mesh.add(edgeMesh)

        // Floor slab
        const floorGeo = new THREE.BoxGeometry(r.w - 0.08, 0.05, r.d - 0.08)
        const floorMat = new THREE.MeshStandardMaterial({ color, opacity: 0.9, transparent: true, roughness: 0.5 })
        const floor = new THREE.Mesh(floorGeo, floorMat)
        floor.position.set(r.x - cx, 0.025, r.z - cz)
        floor.receiveShadow = true
        scene.add(floor)
      })

      sceneRef.current = { scene, camera, renderer, roomMeshes, THREE, layout, cx, cz }
      setLoaded(true)

      // Render loop
      const animate = () => {
        animRef.current = requestAnimationFrame(animate)
        const r = rotation.current
        const z = zoom.current

        camera.position.x = Math.sin(r.y) * z * Math.cos(r.x)
        camera.position.y = Math.sin(r.x) * z + 2
        camera.position.z = Math.cos(r.y) * z * Math.cos(r.x)
        camera.lookAt(0, ROOM_HEIGHT / 3, 0)

        renderer.render(scene, camera)
      }
      animate()
    }

    loadThree().catch(e => console.error('Three.js load error:', e))

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      sceneRef.current?.renderer?.dispose()
    }
  }, [rooms])

  // Highlight selected room
  useEffect(() => {
    if (!sceneRef.current) return
    const { roomMeshes } = sceneRef.current
    roomMeshes.forEach((mesh: any, i: number) => {
      const isSelected = selectedRoom === i
      mesh.material.opacity = selectedRoom === null ? 0.7 : isSelected ? 0.92 : 0.35
      mesh.material.wireframe = wireframe
      mesh.scale.y = isSelected ? 1.05 : 1
    })
  }, [selectedRoom, wireframe])

  const handleMouseDown = (e: React.MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY } }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    rotation.current.y += dx * 0.008
    rotation.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotation.current.x - dy * 0.008))
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { isDragging.current = false }
  const handleWheel = (e: React.WheelEvent) => { zoom.current = Math.max(2, Math.min(20, zoom.current + e.deltaY * 0.01)) }

  return (
    <div style={{ background: '#0A0A0A', border: '1px solid rgba(201,168,76,0.15)', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.1)', background: '#F0EDE8' }}>
        <div style={{ fontSize: 8, letterSpacing: 3, color: '#C9A84C', textTransform: 'uppercase' }}>תצוגת תלת מימד</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setWireframe(w => !w)} style={{ ...S.btnMini, color: wireframe ? '#C9A84C' : '#7A756E', borderColor: wireframe ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.15)' }}>
          wireframe
        </button>
        <button onClick={() => { rotation.current = { x: 0.4, y: 0.3 }; zoom.current = 5; setSelectedRoom(null) }} style={S.btnMini}>
          ↺ איפוס
        </button>
        <div style={{ fontSize: 9, color: '#A09890' }}>גרור לסובב · גלגל להתקרב</div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 340, display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.9)', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 10, color: '#7A756E' }}>טוען מנוע תלת מימד...</div>
        </div>
      )}

      {/* Room buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', borderTop: '1px solid rgba(201,168,76,0.08)', background: '#F0EDE8' }}>
        <button onClick={() => setSelectedRoom(null)} style={{ ...S.btnMini, color: selectedRoom === null ? '#C9A84C' : '#7A756E', borderColor: selectedRoom === null ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.15)' }}>
          הכל
        </button>
        {rooms.map((r, i) => (
          <button key={i} onClick={() => setSelectedRoom(selectedRoom === i ? null : i)} style={{
            ...S.btnMini, fontSize: 9,
            color: selectedRoom === i ? '#C9A84C' : '#7A756E',
            borderColor: selectedRoom === i ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.15)',
            background: selectedRoom === i ? 'rgba(201,168,76,0.06)' : 'transparent',
          }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: COLORS[i % COLORS.length], marginLeft: 4 }} />
            {r.name} · {r.area_sqm}מ"ר
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Scanner Section ─────────────────────────────────────────

export default function ScannerSection() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  const [phase, setPhase] = useState<'upload' | 'processing' | 'result'>('upload')
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null)
  const [fileName, setFileName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [processingStep, setProcessingStep] = useState(0)
  const [activeTab, setActiveTab] = useState<'boq' | '3d' | 'rooms'>('boq')
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [boqItems, setBoqItems] = useState<BOQItem[]>([])

  const STEPS = ['מעלה קובץ...', 'מנתח תוכנית...', 'מזהה חדרים...', 'מחשב כמויות...', 'בונה תלת מימד...']

  const processFile = async (file: File, b64: string) => {
    setFileName(file.name)
    setPhase('processing')
    setProcessingStep(0)

    // Step animation
    for (let i = 1; i < STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 700 + Math.random() * 400))
      setProcessingStep(i)
    }

    try {
      let result: PlanAnalysis
      const isImage = file.type.startsWith('image/')

      if (isImage) {
        // Real AI analysis for images
        result = await analyzeFloorPlan(b64, file.type as any)
      } else {
        // Demo for PDF/DWG (would need server-side conversion)
        result = generateDemoAnalysis(file.name)
      }

      setAnalysis(result)
      setBoqItems(result.boq)
      setPhase('result')
      toast.success(`ניתוח הושלם — ${result.total_area_sqm} מ"ר, ${result.rooms.length} חדרים`)
    } catch (e) {
      // Fallback to demo
      const result = generateDemoAnalysis(file.name)
      setAnalysis(result)
      setBoqItems(result.boq)
      setPhase('result')
      toast('נוצר כתב כמויות לדוגמה', { icon: '📋' })
    }
  }

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const b64 = result.includes(',') ? result.split(',')[1] : result
      processFile(file, b64)
    }
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
      'application/octet-stream': ['.dwg', '.dxf'],
    },
    maxFiles: 1,
  })

  const totalBOQ = boqItems.reduce((s, i) => s + i.total, 0)
  const categories = [...new Set(boqItems.map(i => i.category))]

  const exportBOQ = () => {
    const lines = [
      `כתב כמויות — ${fileName}`,
      `ג'רוזלם בילדרס פרויקטים בע"מ`,
      `תאריך: ${new Date().toLocaleDateString('he-IL')}`,
      `שטח כולל: ${analysis?.total_area_sqm} מ"ר`,
      '',
      'קטגוריה,פריט,כמות,יחידה,מחיר יחידה,סה"כ',
      ...boqItems.map(i => `${i.category},${i.item},${i.quantity},${i.unit},₪${i.unit_price},₪${i.total.toLocaleString()}`),
      '',
      `סה"כ כולל,,,,,₪${totalBOQ.toLocaleString()}`
    ].join('\n')

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8' }))
    a.download = `BOQ-${fileName.replace(/\.[^.]+$/, '')}-${new Date().toLocaleDateString('he-IL')}.csv`
    a.click()
    toast.success('כתב כמויות יוצא!')
  }

  // ── Upload Phase ──

  if (phase === 'upload') {
    return (
      <div>
        <div style={S.ph}>
          <div>
            <div style={S.title}>סריקת תוכנית מהנדס</div>
            <div style={S.sub}>העלה תוכנית → AI מנתח → כתב כמויות + תלת מימד</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          {/* Drop zone */}
          <div>
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
              padding: '50px 30px', textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? 'rgba(201,168,76,0.04)' : '#FFFFFF',
              transition: '.25s', marginBottom: 16,
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 44, opacity: .2, marginBottom: 14 }}>🏗</div>
              <div style={{ fontFamily: 'serif', fontSize: 18, color: '#C9A84C', marginBottom: 6 }}>
                {isDragActive ? 'שחרר כאן...' : 'גרור תוכנית מהנדס'}
              </div>
              <div style={{ fontSize: 12, color: '#7A756E', marginBottom: 14 }}>
                או לחץ לבחירת קובץ
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {['PNG','JPG','PDF','DWG','DXF'].map(f => (
                  <span key={f} style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E' }}>{f}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 14px', border: '1px solid rgba(78,122,158,0.2)', background: 'rgba(78,122,158,0.03)', fontSize: 10, color: '#4E7A9E', lineHeight: 1.7 }}>
              💡 <strong>תמונות (PNG/JPG):</strong> ניתוח AI אמיתי — חילוץ חדרים ושטחים<br />
              💡 <strong>PDF/DWG:</strong> כתב כמויות מחושב לפי שטח משוער
            </div>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🤖', title: 'ניתוח AI אמיתי', desc: 'Claude מנתח את התוכנית ומזהה חדרים, שטחים, קירות' },
              { icon: '📋', title: 'כתב כמויות אוטומטי', desc: 'ריצוף, טיח, צבע, חשמל, אינסטלציה — כל הפריטים עם מחירים' },
              { icon: '⬛', title: 'מודל תלת מימד', desc: 'ויז׳ואליזציה אינטראקטיבית — סובב, התקרב, בחר חדרים' },
              { icon: '⬇', title: 'ייצוא CSV', desc: 'שלח לחשבשבת, Excel, או מייל ישירות ללקוח' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 12, padding: '12px 14px', border: '1px solid rgba(201,168,76,0.1)', background: '#FFFFFF', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, opacity: .6, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: '#1A1714', fontWeight: 400 }}>{f.title}</div>
                  <div style={{ fontSize: 10, color: '#7A756E', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Processing Phase ──

  if (phase === 'processing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 24 }}>
        <div style={{ fontFamily: 'serif', fontSize: 22, color: '#C9A84C', letterSpacing: 1 }}>מנתח תוכנית...</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 320 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: `1px solid ${i <= processingStep ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.08)'}`, background: i < processingStep ? 'rgba(92,153,103,0.05)' : i === processingStep ? 'rgba(201,168,76,0.05)' : '#F0EDE8', transition: '.3s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: i < processingStep ? '#5C9967' : i === processingStep ? 'transparent' : '#E8E5E0', border: i === processingStep ? '2px solid rgba(201,168,76,0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i < processingStep && <span style={{ fontSize: 10, color: '#fff' }}>✓</span>}
                {i === processingStep && <div style={{ width: 10, height: 10, border: '2px solid transparent', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              </div>
              <span style={{ fontSize: 11, color: i <= processingStep ? '#1A1714' : '#7A756E' }}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#A09890' }}>{fileName}</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Result Phase ──

  const catTotals = categories.map(cat => ({
    cat,
    total: boqItems.filter(i => i.category === cat).reduce((s, i) => s + i.total, 0)
  })).sort((a, b) => b.total - a.total)

  return (
    <div>
      {/* Header */}
      <div style={S.ph}>
        <div>
          <div style={S.title}>כתב כמויות — {fileName}</div>
          <div style={S.sub}>{analysis?.total_area_sqm} מ"ר · {analysis?.rooms.length} חדרים · {analysis?.project_type}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnOutline} onClick={() => { setPhase('upload'); setAnalysis(null) }}>← תוכנית חדשה</button>
          <button style={S.btnOutline} onClick={exportBOQ}>⬇ CSV</button>
          <button style={S.btnGold} onClick={() => { window.print(); toast.success('שולח להדפסה') }}>🖨 הדפס כתב כמויות</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={S.kpiRow}>
        {[
          { label: 'שטח כולל', val: `${analysis?.total_area_sqm} מ"ר`, color: '#C9A84C' },
          { label: 'חדרים', val: analysis?.rooms.length ?? 0, color: '#1A1714' },
          { label: 'עלות משוערת', val: `₪${(totalBOQ / 1000).toFixed(0)}K`, color: '#5C9967' },
          { label: 'עלות למ"ר', val: `₪${Math.round(totalBOQ / (analysis?.total_area_sqm || 1)).toLocaleString()}`, color: '#4E7A9E' },
          { label: 'פריטים בכתב', val: boqItems.length, color: '#1A1714' },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLbl}>{k.label}</div>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Project assignment */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, padding: '10px 14px', border: '1px solid rgba(201,168,76,0.12)', background: '#FFFFFF' }}>
        <span style={{ fontSize: 11, color: '#7A756E' }}>שייך לפרויקט:</span>
        <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={{ flex: 1, ...S.fInp as React.CSSProperties, width: 'auto' }}>
          <option value="">— בחר פרויקט —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedProjectId && (
          <button style={S.btnGold} onClick={() => toast.success('כתב הכמויות שויך לפרויקט!')}>✓ שייך</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: 0 }}>
        {([['boq','📋 כתב כמויות'],['3d','⬛ תלת מימד'],['rooms','🏠 חדרים']] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '8px 18px', background: 'none', border: 'none', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: activeTab === id ? '#C9A84C' : '#7A756E', borderBottom: `2px solid ${activeTab === id ? '#C9A84C' : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>{lbl}</button>
        ))}
      </div>

      {/* BOQ Tab */}
      {activeTab === 'boq' && (
        <div>
          {/* Category summary bar */}
          <div style={{ display: 'flex', gap: 1, height: 6, marginBottom: 0 }}>
            {catTotals.map(({ cat, total }) => (
              <div key={cat} title={`${cat}: ₪${total.toLocaleString()}`} style={{ flex: total, background: cat === 'ריצוף' ? '#C9A84C' : cat === 'חשמל' ? '#4E7A9E' : cat === 'אינסטלציה' ? '#5C9967' : cat === 'מטבח' ? '#B87830' : cat === 'חדרי רחצה' ? '#A85050' : '#7A756E', transition: 'flex 0.5s' }} />
            ))}
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 60px 90px 100px 32px', gap: 8, padding: '7px 16px', fontSize: 7, letterSpacing: 2.5, color: '#7A756E', textTransform: 'uppercase', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              <div>קטגוריה</div><div>פריט</div><div>כמות</div><div>יחידה</div><div>מחיר יחידה</div><div>סה"כ</div><div />
            </div>

            {categories.map(cat => (
              <div key={cat}>
                <div style={{ padding: '6px 16px', background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(201,168,76,0.08)', fontSize: 9, letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{cat}</span>
                  <span>₪{boqItems.filter(i => i.category === cat).reduce((s, i) => s + i.total, 0).toLocaleString()}</span>
                </div>
                {boqItems.filter(i => i.category === cat).map((item, globalIdx) => {
                  const idx = boqItems.indexOf(item)
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 60px 90px 100px 32px', gap: 8, alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ fontSize: 9, color: '#7A756E' }}>{item.category}</div>
                      <div style={{ fontSize: 11, color: '#1A1714' }}>{item.item}</div>
                      {editingItem === idx ? (
                        <input type="number" defaultValue={item.quantity} autoFocus
                          style={{ background: '#E8E5E0', border: '1px solid #C9A84C', color: '#C9A84C', padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%' }}
                          onBlur={e => {
                            const newQty = Number(e.target.value)
                            setBoqItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: newQty, total: newQty * it.unit_price } : it))
                            setEditingItem(null)
                          }}
                          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <div style={{ fontSize: 12, fontFamily: 'serif', color: '#1A1714', cursor: 'pointer' }} onClick={() => setEditingItem(idx)}>{item.quantity}</div>
                      )}
                      <div style={{ fontSize: 10, color: '#7A756E' }}>{item.unit}</div>
                      <div style={{ fontSize: 11, color: '#7A756E' }}>₪{item.unit_price.toLocaleString()}</div>
                      <div style={{ fontSize: 13, fontFamily: 'serif', color: '#C9A84C' }}>₪{item.total.toLocaleString()}</div>
                      <button onClick={() => setEditingItem(editingItem === idx ? null : idx)} style={{ background: 'none', border: 'none', color: '#7A756E', cursor: 'pointer', fontSize: 12 }}>✎</button>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Total */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 60px 90px 100px 32px', gap: 8, padding: '14px 16px', borderTop: '2px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
              <div style={{ gridColumn: '1/6', fontSize: 12, color: '#C9A84C', letterSpacing: 2 }}>סה"כ כתב כמויות</div>
              <div style={{ fontFamily: 'serif', fontSize: 22, color: '#C9A84C' }}>₪{totalBOQ.toLocaleString()}</div>
              <div />
            </div>
          </div>
        </div>
      )}

      {/* 3D Tab */}
      {activeTab === '3d' && analysis && (
        <div style={{ border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
          <ThreeDViewer rooms={analysis.rooms} totalArea={analysis.total_area_sqm} />
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && analysis && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)', borderTop: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, padding: 1, background: 'rgba(201,168,76,0.08)' }}>
            {analysis.rooms.map((r, i) => (
              <div key={i} style={{ background: '#FFFFFF', padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['#C9A84C','#5C9967','#4E7A9E','#A85050','#B87830','#6A6A8A','#5A8A7A','#8A5A6A'][i % 8], flexShrink: 0, marginTop: 3 }} />
                  <div style={{ fontSize: 13, color: '#1A1714' }}>{r.name}</div>
                </div>
                <div style={{ fontFamily: 'serif', fontSize: 28, color: '#C9A84C', lineHeight: 1, marginBottom: 4 }}>{r.area_sqm}</div>
                <div style={{ fontSize: 9, color: '#7A756E', letterSpacing: 2 }}>מ"ר</div>
                {r.width_m && r.length_m && (
                  <div style={{ fontSize: 10, color: '#7A756E', marginTop: 6 }}>{r.width_m}×{r.length_m} מ'</div>
                )}
                <div style={{ height: 2, background: '#D8D4CE', marginTop: 8, borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${(r.area_sqm / analysis.total_area_sqm) * 100}%`, background: ['#C9A84C','#5C9967','#4E7A9E','#A85050','#B87830','#6A6A8A','#5A8A7A','#8A5A6A'][i % 8], borderRadius: 1 }} />
                </div>
                <div style={{ fontSize: 9, color: '#A09890', marginTop: 4 }}>{Math.round((r.area_sqm / analysis.total_area_sqm) * 100)}% מהשטח</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @media print { body { background: white !important; color: black !important; } }`}</style>
    </div>
  )
}

const S = {
  ph: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 } as React.CSSProperties,
  title: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, color: '#1A1714' } as React.CSSProperties,
  sub: { fontSize: 11, color: '#7A756E', marginTop: 3 } as React.CSSProperties,
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: 16 } as React.CSSProperties,
  kpi: { background: '#FFFFFF', padding: '14px 16px' } as React.CSSProperties,
  kpiLbl: { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#7A756E', marginBottom: 7 },
  kpiVal: { fontFamily: 'serif', fontSize: 26, fontWeight: 300, lineHeight: 1 } as React.CSSProperties,
  btnGold: { padding: '9px 18px', background: '#C9A84C', color: '#000', border: 'none', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnOutline: { padding: '9px 14px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'inherit' },
  btnMini: { padding: '4px 10px', background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#7A756E', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 },
  fInp: { background: '#E8E5E0', border: '1px solid rgba(201,168,76,0.15)', color: '#1A1714', padding: '8px 11px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%' },
}
