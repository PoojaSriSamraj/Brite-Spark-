// Mock channel implementations with realistic delivery behaviors.
type Result = { success: boolean; reason?: string; silent?: boolean }

export async function sendSms(number: string, message: string): Promise<Result> {
  // Simulate: numbers ending with 0 fail silently, ending with 1 fail loudly
  if (number.endsWith('0')) return { success: false, silent: true }
  if (number.endsWith('1')) return { success: false, reason: 'blocked' }
  return { success: true }
}

export async function sendEmail(email: string, message: string): Promise<Result> {
  if (!email.includes('@')) return { success: false, silent: true }
  if (email.endsWith('@bounced.example')) return { success: false, reason: 'bounced' }
  return { success: true }
}

export async function sendVoice(number: string, message: string): Promise<Result> {
  // voice has higher chance of failure
  if (number.endsWith('7')) return { success: false, silent: true }
  return { success: true }
}
