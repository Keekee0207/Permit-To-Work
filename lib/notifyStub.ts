/**
 * ============================================================================
 * NOTIFICATION SERVICE STUB
 * ============================================================================
 * Provides an extensible interface for dispatching real-time notifications
 * (SMS, Email, Push alerts) to plant personnel, supervisors, and contractors.
 */

export interface NotificationRecipient {
  userId?: string
  email?: string
  name?: string
  role?: string
}

/**
 * Dispatches an alert message to a recipient and outputs an audit log entry
 */
export function notifyStub(
  recipient: NotificationRecipient | string,
  subject: string,
  message: string
) {
  const target = typeof recipient === "string" ? recipient : recipient.email || recipient.name || recipient.role || recipient.userId
  const logMessage = `[STUB NOTIFICATION] To: ${target} | Subject: "${subject}" | Message: "${message}"`
  console.log(logMessage)
  return logMessage
}
