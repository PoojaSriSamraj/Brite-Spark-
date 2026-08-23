const fs = require('fs')
const path = require('path')

function jsonPath() {
  return path.resolve(__dirname, '..', 'data')
}

function readJson(name) {
  const p = path.join(jsonPath(), name)
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

let prisma = null
try {
  const { PrismaClient } = require('@prisma/client')
  prisma = new PrismaClient()
} catch (e) {
  // prisma not available
}

async function getContacts() {
  if (prisma) {
    const residents = await prisma.resident.findMany({ include: { contactPoints: true } })
    // map to previous shape
    return residents.map(r => ({ id: r.id, name: r.name, language: r.language, optOut: r.optOut, contactPoints: r.contactPoints.map(cp => ({ type: cp.type, value: cp.value })) }))
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    const { Client } = require('pg')
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT * FROM contacts')
    await client.end()
    return res.rows
  }
  return readJson('contacts.json')
}

async function getAppointments() {
  if (prisma) {
    const appts = await prisma.appointment.findMany()
    return appts.map(a => ({ id: a.id, residentId: a.residentId, time: a.time, location: a.location, status: a.status }))
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    const { Client } = require('pg')
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT * FROM appointments')
    await client.end()
    return res.rows
  }
  return readJson('appointments.json')
}

module.exports = { getContacts, getAppointments, prisma }
