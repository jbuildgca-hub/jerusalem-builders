export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const geminiKey = process.env.VITE_GEMINI_KEY || 'AIzaSyAJ8JdLVd8dqeWXPNXc-KOC2uu8FExAKEs'

  try {
    const { prompt, imageBase64, mimeType } = req.body
    const parts = []
    if (imageBase64) {
      parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } })
    }
    parts.push({ text: prompt || 'Extract invoice data as JSON' })

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 1500 }
        })
      }
    )
    const data = await response.json()
    if (data.error) return res.status(400).json({ error: data.error.message })
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    res.status(200).json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
