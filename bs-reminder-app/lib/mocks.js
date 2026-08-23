// Mock channel implementations with realistic delivery behaviors.
async function sendSms(number, message) {
  if (number.endsWith('0')) return { success: false, silent: true }
  if (number.endsWith('1')) return { success: false, reason: 'blocked' }
  return { success: true }
}

async function sendEmail(email, message) {
  if (!email.includes('@')) return { success: false, silent: true }
  if (email.endsWith('@bounced.example')) return { success: false, reason: 'bounced' }
  return { success: true }
}

async function sendVoice(number, message) {
  if (number.endsWith('7')) return { success: false, silent: true }
  return { success: true }
}

module.exports = { sendSms, sendEmail, sendVoice }
