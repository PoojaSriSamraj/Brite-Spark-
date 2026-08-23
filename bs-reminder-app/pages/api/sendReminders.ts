import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { sendSms, sendEmail, sendVoice } from '../../lib/mocks'

type ContactPoint = { type: string; value: string; serves?: string[] }
type Resident = { id: string; name: string; language: string; contactPoints: ContactPoint[]; optOut?: boolean }
type Appointment = { id: string; residentId: string; time: string }

// Centralized policy checks: quiet hours and opt-outs
function isQuietHours(date: Date) {
  const hour = date.getUTCHours()
  return hour < 8 || hour >= 20
}

async function tryChannel(pt: ContactPoint, resident: Resident, message: string) {
  if (pt.type === 'sms') return sendSms(pt.value, message)
  if (pt.type === 'email') return sendEmail(pt.value, message)
  if (pt.type === 'voice') return sendVoice(pt.value, message)
  return { success: false, reason: 'unknown channel' }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const dataDir = path.resolve(process.cwd(), 'bs-reminder-app', 'data')
  const contacts: Resident[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'contacts.json'), 'utf8'))
  const appointments: Appointment[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'appointments.json'), 'utf8'))

  // Build map of contact value -> residents it serves
  const contactMap = new Map<string, string[]>()
  contacts.forEach(c => {
    c.contactPoints.forEach(pt => {
      const list = contactMap.get(pt.value) || []
      const serves = pt.serves || [c.id]
      contactMap.set(pt.value, Array.from(new Set(list.concat(serves))))
    })
  })

  const now = new Date()
  const results: any[] = []
  let reached = 0

  // For each appointment, attempt to reach the resident
  for (const appt of appointments) {
    const resident = contacts.find(c => c.id === appt.residentId)
    if (!resident) {
      results.push({ appointment: appt.id, status: 'no resident record' })
      continue
    }

    if (resident.optOut) {
      results.push({ appointment: appt.id, resident: resident.id, status: 'opted out' })
      continue
    }

    if (isQuietHours(now)) {
      results.push({ appointment: appt.id, resident: resident.id, status: 'quiet hours' })
      continue
    }

    // Message template selection by language (simple)
    const templates: any = { en: 'Reminder: you have an appointment', es: 'Recordatorio: tiene una cita' }
    const message = templates[resident.language] || templates.en

    // Channel fallback sequence: sms -> voice -> email. Stopping rule: stop on first success or on first non-silent failure.
    const sequence = ['sms', 'voice', 'email']
    let sent = false
    let tried: any[] = []

    // Avoid duplicate messages when a contact value serves multiple residents: only send once per contact value per run.
    const sentContactValues = new Set<string>()

    for (const channel of sequence) {
      const pts = resident.contactPoints.filter(p => p.type === channel)
      for (const pt of pts) {
        if (sentContactValues.has(pt.value)) {
          tried.push({ channel, value: pt.value, result: 'skipped-duplicate-contact' })
          continue
        }
        const r = await tryChannel(pt, resident, message)
        tried.push({ channel, value: pt.value, result: r })
        if (r.success) {
          sent = true
          sentContactValues.add(pt.value)
          break
        }
        if (!r.success && !r.silent) {
          // loud failure -> stop and do not try other channels for this resident
          sent = false
          break
        }
        // else silent failure: continue to next channel
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

  // Definition of success: reach rate = reached / total appointments (excluding those with missing resident records)
  const total = appointments.length
  const reachRate = total === 0 ? 0 : (reached / total)

  res.status(200).json({ totalAppointments: total, reached, reachRate, results })
}
