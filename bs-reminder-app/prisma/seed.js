const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function main() {
  const prisma = new PrismaClient()
  const dataDir = path.resolve(__dirname, '..', 'data')
  const contacts = JSON.parse(fs.readFileSync(path.join(dataDir, 'contacts.json'), 'utf8'))
  const appointments = JSON.parse(fs.readFileSync(path.join(dataDir, 'appointments.json'), 'utf8'))

  for (const c of contacts) {
    await prisma.resident.upsert({
      where: { id: c.id },
      update: { name: c.name, language: c.language, optOut: !!c.optOut },
      create: {
        id: c.id,
        name: c.name,
        language: c.language,
        optOut: !!c.optOut,
        contactPoints: {
          create: c.contactPoints.map(pt => ({ type: pt.type, value: pt.value, serves: pt.serves || [] }))
        }
      }
    })
  }

  for (const a of appointments) {
    await prisma.appointment.upsert({
      where: { id: a.id },
      update: { time: new Date(a.time) },
      create: {
        id: a.id,
        time: new Date(a.time),
        resident: { connect: { id: a.residentId } }
      }
    })
  }

  console.log('Seed complete')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
