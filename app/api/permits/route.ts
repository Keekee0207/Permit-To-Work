import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerLazyExpiry } from "@/lib/expiryService"
import { PermitStatus, Role, PermitType } from "@prisma/client"
import { getPermitTypeConfig } from "@/lib/permitTypeConfig"
import { notifyStub } from "@/lib/notifyStub"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // Lazy expiry check across system
    await triggerLazyExpiry()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") as PermitStatus | null
    const type = searchParams.get("type") as PermitType | null
    const areaId = searchParams.get("areaId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const pendingMyApproval = searchParams.get("pendingMyApproval") === "true"

    const where: any = {}

    if (status) {
      where.status = status
    }
    if (type) {
      where.type = type
    }
    if (areaId && areaId !== "ALL") {
      where.areaId = areaId
    }
    if (startDate) {
      where.plannedStart = { ...where.plannedStart, gte: new Date(startDate) }
    }
    if (endDate) {
      where.plannedEnd = { ...where.plannedEnd, lte: new Date(endDate) }
    }

    // Strict Privacy Rule: DRAFT permits are strictly private to their creator.
    // Area Owners, Safety Officers, and Admins cannot see drafts created by other users.
    where.OR = [
      { status: { not: PermitStatus.DRAFT } },
      { status: PermitStatus.DRAFT, requesterId: user.userId },
    ]

    // If a specific status of DRAFT was queried, ensure only own drafts are returned
    if (status === PermitStatus.DRAFT) {
      delete where.OR
      where.status = PermitStatus.DRAFT
      where.requesterId = user.userId
    }

    // Role-specific filtering if "pendingMyApproval" requested
    if (pendingMyApproval) {
      where.status = PermitStatus.PENDING_APPROVAL
      if (user.role === Role.AREA_OWNER) {
        where.areaId = { in: user.assignedAreaIds }
        where.requesterId = { not: user.userId } // Self-approval ban
        where.approvals = {
          some: {
            requiredRole: Role.AREA_OWNER,
            decision: "PENDING",
          },
        }
      } else if (user.role === Role.SAFETY_OFFICER) {
        where.requesterId = { not: user.userId } // Self-approval ban
        where.approvals = {
          some: {
            requiredRole: Role.SAFETY_OFFICER,
            decision: "PENDING",
          },
        }
      } else if (user.role === Role.ADMIN) {
        where.requesterId = { not: user.userId }
      }
    }

    const permits = await prisma.permit.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, role: true } },
        plant: { select: { id: true, name: true, code: true } },
        area: { select: { id: true, name: true, code: true } },
        equipment: { select: { id: true, name: true, tagCode: true } },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ permits })
  } catch (err: any) {
    console.error("List permits error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // Enforce role restriction: Only REQUESTER and ADMIN can create permits
    if (user.role !== Role.REQUESTER && user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Only Requesters and Admins can create permits. Area Owners and Safety Officers are restricted to approval actions." },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      type,
      workDescription,
      contractorTeam,
      plantId,
      areaId,
      equipmentId,
      plannedStart,
      plannedEnd,
      hazards,
      ppeRequired,
      precautionsChecklist,
      typeSpecificData,
      photoUrl,
      submitNow, // boolean: whether to save as DRAFT or submit immediately
    } = body

    if (!type || !workDescription || !contractorTeam || !plantId || !areaId || !plannedStart || !plannedEnd) {
      return NextResponse.json({ error: "All required basic permit fields must be provided" }, { status: 400 })
    }

    const startDate = new Date(plannedStart)
    const endDate = new Date(plannedEnd)
    if (endDate <= startDate) {
      return NextResponse.json({ error: "Planned end time must be after planned start time" }, { status: 400 })
    }

    // Validate type specific data if submitting or provided
    const config = getPermitTypeConfig(type as PermitType)
    if (submitNow) {
      const parseResult = config.schema.safeParse(typeSpecificData || {})
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Validation failed for permit type specific fields", details: parseResult.error.flatten() },
          { status: 400 }
        )
      }
    }

    // Generate unique permit number: e.g. PTW-2024-0012
    const count = await prisma.permit.count()
    const permitNumber = `PTW-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`

    const initialStatus = submitNow ? PermitStatus.PENDING_APPROVAL : PermitStatus.DRAFT

    const permit = await prisma.$transaction(async (tx) => {
      const newPermit = await tx.permit.create({
        data: {
          permitNumber,
          type: type as PermitType,
          status: initialStatus,
          requesterId: user.userId,
          contractorTeam,
          workDescription,
          plantId,
          areaId,
          equipmentId: equipmentId || null,
          plannedStart: startDate,
          plannedEnd: endDate,
          hazards: hazards || config.standardHazards,
          ppeRequired: ppeRequired || config.standardPpe,
          precautionsChecklist: precautionsChecklist || config.standardPrecautions,
          typeSpecificData: typeSpecificData || {},
          photoUrl: photoUrl || null,
        },
      })

      // Create required approval slots: AREA_OWNER and SAFETY_OFFICER
      await tx.permitApproval.createMany({
        data: [
          {
            permitId: newPermit.id,
            requiredRole: Role.AREA_OWNER,
            decision: "PENDING",
          },
          {
            permitId: newPermit.id,
            requiredRole: Role.SAFETY_OFFICER,
            decision: "PENDING",
          },
        ],
      })

      // Add audit log
      await tx.auditLog.create({
        data: {
          permitId: newPermit.id,
          actorId: user.userId,
          action: submitNow ? "CREATED_AND_SUBMITTED" : "CREATED_DRAFT",
          fromValue: null,
          toValue: initialStatus,
          comment: submitNow
            ? `Permit ${permitNumber} created and submitted directly for review.`
            : `Permit ${permitNumber} created as DRAFT.`,
        },
      })

      return newPermit
    })

    if (submitNow) {
      notifyStub(
        "Area Owners & Safety Officers",
        `New Permit Submitted: ${permitNumber}`,
        `Permit ${permitNumber} (${type}) has been submitted by ${user.name} and awaits review.`
      )
    }

    return NextResponse.json({ permit }, { status: 201 })
  } catch (err: any) {
    console.error("Create permit error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
