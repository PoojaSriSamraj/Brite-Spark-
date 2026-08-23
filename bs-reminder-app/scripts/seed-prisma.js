const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function seed() {
  const prisma = new PrismaClient()
  const dataDir = path.resolve(__dirname, '..', 'data')
  const contactsPath = path.join(dataDir, 'contacts.json')
  const apptsPath = path.join(dataDir, 'appointments.json')
  if (!fs.existsSync(contactsPath) || !fs.existsSync(apptsPath)) {
    console.error('contacts.json or appointments.json not found in data/. Run seed-from-csv first.')
    process.exit(1)
  }
  const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'))
  const appts = JSON.parse(fs.readFileSync(apptsPath, 'utf8'))

  for (const c of contacts) {
    await prisma.resident.upsert({
      where: { id: c.id },
      update: { name: c.name, language: c.language || null, optOut: !!c.optOut },
      create: { id: c.id, name: c.name, language: c.language || null, optOut: !!c.optOut }
    })
    // replace contact points
    if (c.contactPoints && c.contactPoints.length) {
      for (const cp of c.contactPoints) {
        await prisma.contactPoint.upsert({
          where: { id: cp.id || `${c.id}-${cp.type}-${cp.value}` },
          update: { type: cp.type, value: cp.value, residentId: c.id },
          create: { id: cp.id || `${c.id}-${cp.type}-${cp.value}`, type: cp.type, value: cp.value, residentId: c.id }
        })
      }
    }
  }

  for (const a of appts) {
    const time = a.time ? new Date(a.time) : null
    await prisma.appointment.upsert({
      where: { id: a.id },
      update: { residentId: a.residentId || null, time: time, location: a.location || null, status: a.status || null },
      create: { id: a.id, residentId: a.residentId || null, time: time, location: a.location || null, status: a.status || null }
    })
  }

  await prisma.$disconnect()
  console.log('Prisma seeding complete')
}

if (require.main === module) seed().catch(e => { console.error(e); process.exit(1) })
