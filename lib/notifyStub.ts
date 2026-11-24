export interface NotificationRecipient {
  userId?: string
  email?: string
  name?: string
  role?: string
}

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
