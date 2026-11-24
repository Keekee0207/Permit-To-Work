import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitStateMachine } from "@/lib/permitStateMachine"
import { Role, ExtensionStatus } from "@prisma/client"
import { notifyStub } from "@/lib/notifyStub"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
      include: { extensions: true, requester: true },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    const { requestedHours, reason } = await req.json()

    const ctx = {
      permit,
      currentUser: {
        id: user.userId,
        role: user.role,
        name: user.name,
      },
      now: new Date(),
    }

    const check = PermitStateMachine.canRequestExtension(ctx, Number(requestedHours), reason)
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const extension = await prisma.$transaction(async (tx) => {
      const ext = await tx.extensionRequest.create({
        data: {
          permitId: permit.id,
          requestedById: user.userId,
          requestedHours: Number(requestedHours),
          reason: reason.trim(),
          status: ExtensionStatus.PENDING,
        },
      })

      await tx.auditLog.create({
        data: {
          permitId: permit.id,
          actorId: user.userId,
          action: "EXTENSION_REQUESTED",
          fromValue: permit.extendedUntil?.toISOString() || permit.plannedEnd.toISOString(),
          toValue: `+${requestedHours} hours`,
          comment: `Extension requested: ${reason}`,
        },
      })

      return ext
    })

    notifyStub(
      "Safety Officers",
      `Extension Requested for ${permit.permitNumber}`,
      `${user.name} requested a +${requestedHours}h extension for reason: "${reason}".`
    )

    return NextResponse.json({ success: true, extension }, { status: 201 })
  } catch (err: any) {
    console.error("Extension request error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // Rule: Safety Officer or Admin approves extension requests
    if (user.role !== Role.SAFETY_OFFICER && user.role !== Role.ADMIN) {
      return forbiddenResponse("Only Safety Officers or Admins can review extension requests.")
    }

    const { extensionId, decision, comment } = await req.json()

    if (!extensionId || !decision) {
      return NextResponse.json({ error: "extensionId and decision (APPROVED/REJECTED) are required" }, { status: 400 })
    }

    const extension = await prisma.extensionRequest.findUnique({
      where: { id: extensionId },
      include: { permit: { include: { requester: true } } },
    })

    if (!extension || extension.permitId !== params.id) {
      return NextResponse.json({ error: "Extension request not found" }, { status: 404 })
    }

    if (extension.status !== ExtensionStatus.PENDING) {
      return NextResponse.json({ error: "This extension request has already been reviewed" }, { status: 400 })
    }

    // Rule: Self-approval ban
    if (extension.permit.requesterId === user.userId) {
      return NextResponse.json({ error: "Self-approval ban: You cannot approve an extension on your own permit." }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ext = await tx.extensionRequest.update({
        where: { id: extensionId },
        data: {
          status: decision as ExtensionStatus,
          reviewedById: user.userId,
          comment: comment || null,
          reviewedAt: new Date(),
        },
      })

      let newExtendedUntil: Date | null = null
      if (decision === ExtensionStatus.APPROVED) {
        const baseDate = extension.permit.extendedUntil
          ? new Date(extension.permit.extendedUntil)
          : new Date(extension.permit.plannedEnd)
        newExtendedUntil = new Date(baseDate.getTime() + extension.requestedHours * 60 * 60 * 1000)

        await tx.permit.update({
          where: { id: extension.permitId },
          data: { extendedUntil: newExtendedUntil },
        })
      }

      await tx.auditLog.create({
        data: {
          permitId: extension.permitId,
          actorId: user.userId,
          action: decision === ExtensionStatus.APPROVED ? "EXTENSION_APPROVED" : "EXTENSION_REJECTED",
          fromValue: extension.permit.extendedUntil?.toISOString() || extension.permit.plannedEnd.toISOString(),
          toValue: newExtendedUntil?.toISOString() || "REJECTED",
          comment: comment || `Extension ${decision.toLowerCase()} by Safety Officer (${user.name})`,
        },
      })

      return ext
    })

    notifyStub(
      extension.permit.requester.email,
      `Extension Request ${decision} for ${extension.permit.permitNumber}`,
      `Your request for +${extension.requestedHours}h was ${decision.toLowerCase()} by ${user.name}.`
    )

    return NextResponse.json({ success: true, extension: updated })
  } catch (err: any) {
    console.error("Extension review error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
