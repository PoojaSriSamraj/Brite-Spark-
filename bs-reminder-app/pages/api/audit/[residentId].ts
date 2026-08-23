import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { residentId } = req.query
  if (!residentId || Array.isArray(residentId)) {
    return res.status(400).json({ error: 'residentId required' })
  }
  const asOfParam = req.query.asOf as string | undefined
  const asOf = asOfParam ? new Date(asOfParam) : new Date()
  const since = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000)
  try {
    const attempts = await prisma.contactAttempt.findMany({ where: { residentId, timestamp: { gte: since, lt: asOf } }, orderBy: { timestamp: 'desc' } })
    const counted = attempts.filter(a => a.counted)
    res.status(200).json({ residentId, asOf: asOf.toISOString(), windowStart: since.toISOString(), totalAttempts: attempts.length, countedAttempts: counted.length, attempts })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
