const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function usage(residentId, asOf) {
  const asDate = asOf ? new Date(asOf) : new Date()
  const since = new Date(asDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  const attempts = await db.contactAttempt.findMany({ where: { residentId, timestamp: { gte: since, lt: asDate } }, orderBy: { timestamp: 'desc' } })
  const counted = attempts.filter(a => a.counted)
  console.log(JSON.stringify({ residentId, asOf: asDate.toISOString(), windowStart: since.toISOString(), totalAttempts: attempts.length, countedAttempts: counted.length, attempts }, null, 2))
}

if (require.main === module) {
  const residentId = process.argv[2]
  const asOf = process.argv[3]
  if (!residentId) {
    console.error('Usage: node scripts/audit-resident.js <RESIDENT_ID> [YYYY-MM-DD]')
    process.exit(2)
  }
  usage(residentId, asOf).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
}
