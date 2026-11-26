/**
 * ============================================================================
 * SINGLE PERMIT RESOURCE API (/api/permits/[id])
 * ============================================================================
 * GET - Fetches single permit details, hierarchy, approvals, and audit trail.
 * PUT - Updates an editable private draft prior to formal submission.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerLazyExpiry } from "@/lib/expiryService"
import { PermitStatus, Role } from "@prisma/client"
import { getPermitTypeConfig } from "@/lib/permitTypeConfig"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // Trigger lazy expiry across the system first
    await triggerLazyExpiry()

    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
      include: {
        requester: { select: { id: true, name: true, email: true, role: true } },
        plant: true,
        area: {
          include: {
            assignedUsers: { select: { userId: true } },
          },
        },
        equipment: true,
        approvals: {
          include: {
            approver: { select: { id: true, name: true, role: true } },
          },
        },
        extensions: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          include: {
            actor: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    // Strict Privacy Rule: DRAFT permits can ONLY be viewed by their creator
    // Even Admins, Area Owners, and Safety Officers cannot access someone else's draft
    if (permit.status === PermitStatus.DRAFT && permit.requesterId !== user.userId) {
      return NextResponse.json(
        { error: "Access denied. Draft permits are private to the creator until submitted." },
        { status: 403 }
      )
    }

    return NextResponse.json({ permit })
  } catch (err: any) {
    console.error("Get permit error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    // Only DRAFT permits can be updated via general PUT
    if (permit.status !== PermitStatus.DRAFT) {
      return NextResponse.json(
        { error: "Only permits in DRAFT status can have their general details edited." },
        { status: 400 }
      )
    }

    if (user.role === Role.REQUESTER && permit.requesterId !== user.userId) {
      return NextResponse.json({ error: "You can only edit your own draft permits." }, { status: 403 })
    }

    const body = await req.json()
    const {
      workDescription,
      contractorTeam,
      equipmentId,
      plannedStart,
      plannedEnd,
      hazards,
      ppeRequired,
      precautionsChecklist,
      typeSpecificData,
      photoUrl,
    } = body

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.permit.update({
        where: { id: params.id },
        data: {
          workDescription: workDescription ?? permit.workDescription,
          contractorTeam: contractorTeam ?? permit.contractorTeam,
          equipmentId: equipmentId !== undefined ? equipmentId : permit.equipmentId,
          plannedStart: plannedStart ? new Date(plannedStart) : permit.plannedStart,
          plannedEnd: plannedEnd ? new Date(plannedEnd) : permit.plannedEnd,
          hazards: hazards ?? permit.hazards,
          ppeRequired: ppeRequired ?? permit.ppeRequired,
          precautionsChecklist: precautionsChecklist ?? permit.precautionsChecklist,
          typeSpecificData: typeSpecificData ?? permit.typeSpecificData,
          photoUrl: photoUrl !== undefined ? photoUrl : permit.photoUrl,
        },
      })

      await tx.auditLog.create({
        data: {
          permitId: permit.id,
          actorId: user.userId,
          action: "DRAFT_EDITED",
          comment: "Draft details updated by user.",
        },
      })

      return p
    })

    return NextResponse.json({ permit: updated })
  } catch (err: any) {
    console.error("Update permit error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
