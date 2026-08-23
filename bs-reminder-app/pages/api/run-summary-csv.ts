import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const dataPath = path.join(process.cwd(), 'bs-reminder-app', 'data', 'run-summary.csv')
  if (!fs.existsSync(dataPath)) return res.status(404).json({ error: 'run-summary.csv not found' })
  const content = fs.readFileSync(dataPath, 'utf8')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="run-summary.csv"')
  res.status(200).send(content)
}
