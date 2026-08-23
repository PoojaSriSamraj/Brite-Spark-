const fs = require('fs')
const path = require('path')

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] })
    return obj
  })
}

async function seed(folderPath) {
  const abs = path.resolve(folderPath)
  console.log('Reading CSVs from', abs)
  const contactsCsv = fs.readFileSync(path.join(abs, 'contacts.csv'), 'utf8')
  const apptsCsv = fs.readFileSync(path.join(abs, 'appointments.csv'), 'utf8')

  const contacts = parseCsv(contactsCsv)
  const appointments = parseCsv(apptsCsv)

  // Normalize contacts into prototype JSON shape
  const normContacts = contacts.map(c => ({
    id: c.resident_id || c.residentId || c.id || String(Math.random()).slice(2),
    name: c.name || c.full_name || '',
    language: c.language || 'en',
    optOut: (c.sms_optout || c.smsOptOut || c.opt_out || c.optOut || '').toLowerCase() === 'y' || (c.opt_out || '').toLowerCase() === 'true',
    contactPoints: []
  }))

  // Build contactPoints from CSV columns like phone/email
  contacts.forEach((c, idx) => {
    const target = normContacts[idx]
    if (c.mobile) target.contactPoints.push({ type: 'sms', value: c.mobile.replace(/[^0-9+]/g, '') })
    if (c.landline) target.contactPoints.push({ type: 'voice', value: c.landline.replace(/[^0-9+]/g, '') })
    if (c.email) target.contactPoints.push({ type: 'email', value: c.email })
  })

  const outDir = path.resolve(__dirname, '..', 'data')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  // Normalize appointments to { id, residentId, time }
  const normAppointments = appointments.map(a => ({
    id: a.appointment_id || a.id || a.appointmentId || String(Math.random()).slice(2),
    residentId: a.resident_id || a.residentId || a.resident || a.contact || null,
    time: a.scheduled_at || a.time || a.datetime || a.date || null,
    location: a.location || null,
    status: a.status || null
  }))

  fs.writeFileSync(path.join(outDir, 'contacts.json'), JSON.stringify(normContacts, null, 2))
  fs.writeFileSync(path.join(outDir, 'appointments.json'), JSON.stringify(normAppointments, null, 2))

  console.log('Wrote contacts.json and appointments.json to', outDir)

  // If DATABASE_URL is set to Postgres, attempt to insert
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    console.log('DATABASE_URL present, inserting into Postgres...')
    const { Client } = require('pg')
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    // create tables if needed
    await client.query(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, language TEXT, optout BOOLEAN, contactpoints JSONB)`)
    await client.query(`CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, residentid TEXT, time TIMESTAMP)`)
    for (const c of normContacts) {
      await client.query('INSERT INTO contacts(id,name,language,optout,contactpoints) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [c.id, c.name, c.language, c.optOut, JSON.stringify(c.contactPoints)])
    }
    for (const a of appointments) {
      await client.query('INSERT INTO appointments(id,residentid,time) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING', [a.id || a.appointment_id || String(Math.random()).slice(2), a.residentId || a.resident_id || a.resident || a.contact, a.time || a.datetime || a.date])
    }
    await client.end()
    console.log('Seeded Postgres')
  }
}

if (require.main === module) {
  const folder = process.argv[2] || path.resolve(__dirname, '..', '..', '07-reminder-that-reaches')
  seed(folder).catch(err => { console.error(err); process.exit(1) })
}
