/**
 * ============================================================================
 * AUTOMATED EXPIRATION SERVICE
 * ============================================================================
 * Enforces hard time limits on work permits. In industrial plants, working
 * under an expired permit is a severe safety violation.
 *
 * This service runs:
 * 1. Lazily when the permits list or detail is retrieved (throttled to max 1x / 30s)
 * 2. On a cron schedule (every 5-15 mins) via /api/cron/expire
 *
 * Hard Rule:
 * Any permit that is ACTIVE or APPROVED whose plannedEnd (or extendedUntil)
 * is in the past MUST transition immediately to EXPIRED.
 */

import { prisma } from "./prisma"
import { PermitStatus } from "@prisma/client"
import { notifyStub } from "./notifyStub"

let lastLazyExpiryRun = 0

export async function triggerLazyExpiry(force: boolean = false): Promise<number> {
  const nowMs = Date.now()
  // Throttle to avoid repeated table scans on every rapid API call
  if (!force && nowMs - lastLazyExpiryRun < 30_000) {
    return 0
  }
  lastLazyExpiryRun = nowMs

  const now = new Date()

  // Find all open permits whose deadline has passed
  const expiredCandidates = await prisma.permit.findMany({
    where: {
      status: {
        in: [PermitStatus.ACTIVE, PermitStatus.APPROVED],
      },
      OR: [
        {
          extendedUntil: { not: null, lt: now },
        },
        {
          extendedUntil: null,
          plannedEnd: { lt: now },
        },
      ],
    },
    include: {
      requester: true,
    },
  })

  if (expiredCandidates.length === 0) {
    return 0
  }

  for (const permit of expiredCandidates) {
    // 1. Update status to EXPIRED
    await prisma.permit.update({
      where: { id: permit.id },
      data: { status: PermitStatus.EXPIRED },
    })

    // 2. Add an audit log entry for industrial traceability
    await prisma.auditLog.create({
      data: {
        permitId: permit.id,
        actorId: permit.requesterId, // System auto-event recorded under permit owner context
        action: "AUTO_EXPIRED",
        fromValue: permit.status,
        toValue: PermitStatus.EXPIRED,
        comment: `Permit exceeded maximum authorized validity window (${
          permit.extendedUntil ? "extended" : "planned"
        } deadline passed). Work must cease immediately.`,
      },
    })

    // 3. Notify the requester that work must cease
    notifyStub(
      permit.requester.email,
      `[AUTO-EXPIRED] Permit ${permit.permitNumber} has Expired`,
      `Safety Notice: Work under Permit ${permit.permitNumber} must stop immediately as the authorized validity window has ended.`
    )
  }

  return expiredCandidates.length
}
