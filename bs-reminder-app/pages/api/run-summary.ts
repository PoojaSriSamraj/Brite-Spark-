import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const dataPath = path.join(process.cwd(), 'bs-reminder-app', 'data', 'run-summary.json')
  if (!fs.existsSync(dataPath)) return res.status(404).json({ error: 'run-summary not found' })
  const content = fs.readFileSync(dataPath, 'utf8')
  try {
    const j = JSON.parse(content)
    res.status(200).json(j)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
