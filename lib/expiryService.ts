import { prisma } from "./prisma"
import { PermitStatus } from "@prisma/client"
import { notifyStub } from "./notifyStub"

/**
 * Lazy Expiry: Checks and automatically transitions expired permits in
 * PENDING_APPROVAL or ACTIVE to EXPIRED.
 * Can be run for a single permit, a list, or the whole database.
 */
export async function triggerLazyExpiry(permitId?: string): Promise<number> {
  const now = new Date()

  // Find permits that should be expired
  const whereCondition: any = {
    status: { in: [PermitStatus.PENDING_APPROVAL, PermitStatus.ACTIVE] },
    OR: [
      { extendedUntil: { not: null, lt: now } },
      { extendedUntil: null, plannedEnd: { lt: now } },
    ],
  }

  if (permitId) {
    whereCondition.id = permitId
  }

  const expiredCandidates = await prisma.permit.findMany({
    where: whereCondition,
    include: {
      requester: true,
    },
  })

  if (expiredCandidates.length === 0) {
    return 0
  }

  for (const permit of expiredCandidates) {
    await prisma.$transaction(async (tx) => {
      await tx.permit.update({
        where: { id: permit.id },
        data: { status: PermitStatus.EXPIRED },
      })

      await tx.auditLog.create({
        data: {
          permitId: permit.id,
          actorId: permit.requesterId, // recorded with system context attributed to requester
          action: "AUTO_EXPIRED",
          fromValue: permit.status,
          toValue: PermitStatus.EXPIRED,
          comment: `System auto-expiry triggered: validity ended at ${
            permit.extendedUntil?.toISOString() || permit.plannedEnd.toISOString()
          }.`,
        },
      })
    })

    notifyStub(
      permit.requester.email,
      `Permit ${permit.permitNumber} Expired`,
      `Your permit ${permit.permitNumber} has reached its planned validity limit and transitioned to EXPIRED.`
    )
  }

  return expiredCandidates.length
}
