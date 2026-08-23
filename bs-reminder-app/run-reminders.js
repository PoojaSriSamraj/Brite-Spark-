const { sendSms, sendEmail, sendVoice } = require('./lib/mocks')
const db = require('./lib/db')
const fs = require('fs')
const path = require('path')

function isQuietHours(date) {
  const hour = date.getUTCHours()
  return hour < 8 || hour >= 20
}

async function tryChannel(pt, resident, message) {
  if (pt.type === 'sms') return sendSms(pt.value, message)
  if (pt.type === 'email') return sendEmail(pt.value, message)
  if (pt.type === 'voice') return sendVoice(pt.value, message)
  return { success: false, reason: 'unknown channel' }
}

async function run() {
  const contacts = await db.getContacts()
  const appointments = await db.getAppointments()

  const now = new Date()
  let reached = 0
  const results = []
  const prisma = db.prisma

  for (const appt of appointments) {
    const resident = contacts.find(c => c.id === appt.residentId)
    if (!resident) {
      results.push({ appointment: appt.id, status: 'no resident record' })
      continue
    }
    if (resident.optOut) {
      // global opt-out: record for auditability
      if (prisma) {
        await prisma.contactAttempt.create({ data: { residentId: resident.id, appointmentId: appt.id, timestamp: now, channel: null, result: 'opted-out', counted: false } })
      }
      results.push({ appointment: appt.id, resident: resident.id, status: 'opted out' })
      continue
    }
    // Regulation: limit to 2 contacts in any rolling 7-day period per resident
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    let recentCount = 0
    if (prisma) {
      recentCount = await prisma.contactAttempt.count({ where: { residentId: resident.id, timestamp: { gte: sevenDaysAgo } } })
    } else {
      // fallback: no prisma available, assume 0
      recentCount = 0
    }
    if (recentCount >= 2) {
      // record the withheld fact per Direction CR-2026/11 (must record when prevented)
      if (prisma) {
        await prisma.contactAttempt.create({ data: { residentId: resident.id, appointmentId: appt.id, timestamp: now, channel: null, result: 'withheld-regulation', counted: false } })
      }
      results.push({ appointment: appt.id, resident: resident.id, status: 'withheld-regulation', recentCount })
      continue
    }
    if (isQuietHours(now)) {
      results.push({ appointment: appt.id, resident: resident.id, status: 'quiet hours' })
      continue
    }

    const templates = { en: 'Reminder: you have an appointment', es: 'Recordatorio: tiene una cita' }
    const message = templates[resident.language] || templates.en

    const sequence = ['sms', 'voice', 'email']
    let sent = false
    const tried = []
    const sentContactValues = new Set()

    for (const channel of sequence) {
      // Skip entire channel if resident-level channel opt-out is set (e.g. sms_optout)
      if (resident[`${channel}_optout`]) {
        // record an audit entry for the channel-level opt-out
        if (prisma) {
          await prisma.contactAttempt.create({ data: { residentId: resident.id, appointmentId: appt.id, timestamp: new Date(), channel, result: 'opted-out-channel', counted: false } })
        }
        tried.push({ channel, value: null, result: { success: false, reason: 'resident_channel_opt_out' } })
        continue
      }

      const pts = resident.contactPoints.filter(p => p.type === channel)
      for (const pt of pts) {
        // per-contact-point opt-out (e.g. pt.optOut) — skip if present
        if (pt.optOut) {
          if (prisma) {
            await prisma.contactAttempt.create({ data: { residentId: resident.id, appointmentId: appt.id, timestamp: new Date(), channel: pt.type, result: 'opted-out-contactpoint', counted: false } })
          }
          tried.push({ channel, value: pt.value, result: { success: false, reason: 'contact_point_opt_out' } })
          continue
        }
        if (sentContactValues.has(pt.value)) {
          tried.push({ channel, value: pt.value, result: 'skipped-duplicate-contact' })
          continue
        }
        // eslint-disable-next-line no-await-in-loop
        const r = await tryChannel(pt, resident, message)
        tried.push({ channel, value: pt.value, result: r })
        // record the attempt (counts even if failed)
        if (prisma) {
          await prisma.contactAttempt.create({ data: { residentId: resident.id, appointmentId: appt.id, timestamp: new Date(), channel: pt.type, result: r.success ? 'delivered' : (r.reason || 'failed'), counted: true } })
        }
        if (r.success) {
          sent = true
          sentContactValues.add(pt.value)
          break
        }
        if (!r.success && !r.silent) {
          sent = false
          break
        }
      }
      if (sent) break
    }

    if (sent) {
      reached += 1
      results.push({ appointment: appt.id, resident: resident.id, status: 'reached', tried })
    } else {
      results.push({ appointment: appt.id, resident: resident.id, status: 'unreached', tried })
    }
  }

  const total = appointments.length
  const reachRate = total === 0 ? 0 : (reached / total)
  const summary = { totalAppointments: total, reached, reachRate, results }
  // write JSON summary
  const outDir = path.join(__dirname, 'data')
  try { fs.mkdirSync(outDir, { recursive: true }) } catch (e) {}
  fs.writeFileSync(path.join(outDir, 'run-summary.json'), JSON.stringify(summary, null, 2))
  // write CSV summary (one row per appointment)
  const csvLines = ['appointment,resident,status,attempts']
  for (const r of results) {
    const attempts = (r.tried && r.tried.length) ? JSON.stringify(r.tried) : ''
    csvLines.push([r.appointment, r.resident || '', r.status, '"' + attempts.replace(/"/g, '""') + '"'].join(','))
  }
  fs.writeFileSync(path.join(outDir, 'run-summary.csv'), csvLines.join('\n'))
  console.log(JSON.stringify(summary, null, 2))
}

run().catch(err => { console.error(err); process.exit(1) })
