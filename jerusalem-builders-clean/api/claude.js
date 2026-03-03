export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const openaiKey = process.env.OPENAI_KEY
  const { prompt, imageBase64, mimeType } = req.body

  try {
    const messages = [{
      role: 'user',
      content: imageBase64
        ? [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        : [{ type: 'text', text: prompt }]
    }]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({ model: 'gpt-4o', messages, max_tokens: 1500 })
    })

    const data = await response.json()
    if (data.error) return res.status(400).json({ error: data.error.message })
    const text = data.choices?.[0]?.message?.content || ''
    res.status(200).json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
