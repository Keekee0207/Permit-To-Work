import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitType, PermitStatus } from "@prisma/client"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    const { type, plantId, areaId, plannedStart, plannedEnd, excludePermitId } = await req.json()

    if (!type || !areaId || !plannedStart || !plannedEnd) {
      return NextResponse.json({ conflicts: [] })
    }

    const start = new Date(plannedStart)
    const end = new Date(plannedEnd)

    // Check conflict rule:
    // If HOT_WORK, conflicts with existing CONFINED_SPACE in same area during overlapping time
    // If CONFINED_SPACE, conflicts with existing HOT_WORK in same area during overlapping time
    let conflictingTypes: PermitType[] = []
    if (type === PermitType.HOT_WORK) {
      conflictingTypes = [PermitType.CONFINED_SPACE]
    } else if (type === PermitType.CONFINED_SPACE) {
      conflictingTypes = [PermitType.HOT_WORK]
    }

    if (conflictingTypes.length === 0) {
      return NextResponse.json({ conflicts: [] })
    }

    const overlappingPermits = await prisma.permit.findMany({
      where: {
        id: excludePermitId ? { not: excludePermitId } : undefined,
        areaId,
        type: { in: conflictingTypes },
        status: { in: [PermitStatus.APPROVED, PermitStatus.ACTIVE, PermitStatus.PENDING_APPROVAL] },
        AND: [
          { plannedStart: { lt: end } },
          {
            OR: [
              { extendedUntil: { not: null, gt: start } },
              { extendedUntil: null, plannedEnd: { gt: start } },
            ],
          },
        ],
      },
      include: {
        area: true,
        requester: { select: { name: true } },
      },
    })

    const conflicts = overlappingPermits.map((p) => ({
      permitId: p.id,
      permitNumber: p.permitNumber,
      type: p.type,
      status: p.status,
      areaName: p.area.name,
      plannedStart: p.plannedStart,
      plannedEnd: p.extendedUntil || p.plannedEnd,
      requesterName: p.requester.name,
      warning: `HIGH RISK CONFLICT: A ${p.type} permit (${p.permitNumber}) is active or pending in ${p.area.name} during this timeframe! Operating Hot Work and Confined Space concurrently in the same area poses severe fire and atmosphere hazards.`,
    }))

    return NextResponse.json({ conflicts })
  } catch (err: any) {
    console.error("Conflict check error:", err)
    return NextResponse.json({ error: "Conflict check failed" }, { status: 500 })
  }
}
