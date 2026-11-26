/**
 * =========================================================================================
 * PERMIT WORK-WINDOW EXTENSION CONTROLLER (API ROUTE)
 * =========================================================================================
 * Path: /api/permits/[id]/extensions
 * Methods:
 *   - POST : Submit a new time extension request (Requester / Admin)
 *   - PUT  : Review, approve, or reject an extension request (Safety Officer / Admin)
 *
 * INDUSTRIAL SAFETY PRINCIPLES & RULES:
 * 1. Hard Rule 5 - Extension Request Eligibility:
 *    - An extension can only be requested on an ACTIVE permit before it expires.
 *    - Once a permit has lapsed into EXPIRED or CLOSED status, no further extensions are permitted;
 *      a brand new permit must be raised and re-authorized.
 * 2. Maximum Extension Limit:
 *    - Cumulative extension cannot exceed 4 to 8 hours depending on plant guidelines.
 * 3. Self-Approval Ban (Strict):
 *    - If a Safety Officer raised or requested the permit, they CANNOT approve their own extension.
 * 4. Automatic Recalculation:
 *    - Upon approval, the permit's `extendedUntil` timestamp is recalculated:
 *      (previous extendedUntil || plannedEnd) + requestedHours.
 * 5. Full Notification & Audit Trail:
 *    - Dispatches alerts via `notifyStub` and records audit entries with timestamps.
 * =========================================================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitStateMachine } from "@/lib/permitStateMachine"
import { Role, ExtensionStatus } from "@prisma/client"
import { notifyStub } from "@/lib/notifyStub"

/**
 * -----------------------------------------------------------------------------------------
 * POST: Request a Permit Extension
 * -----------------------------------------------------------------------------------------
 * Accessible by: The Permit Requester or an ADMIN.
 * Body: { requestedHours: number, reason: string }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Authenticate user from session cookie
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // 2. Fetch target permit including existing extensions
    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
      include: { extensions: true, requester: true },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    const { requestedHours, reason } = await req.json()

    // 3. Prepare state machine context
    const ctx = {
      permit,
      currentUser: {
        id: user.userId,
        role: user.role,
        name: user.name,
      },
      now: new Date(),
    }

    // 4. Validate extension eligibility using deterministic state machine rules:
    //    - Must be ACTIVE
    //    - Must not be expired yet
    //    - Must have a valid numeric duration and justified reason
    const check = PermitStateMachine.canRequestExtension(ctx, Number(requestedHours), reason)
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    // 5. Atomic transaction: Create ExtensionRequest record and write AuditLog entry
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

    // 6. Notify Safety Officers on duty
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

/**
 * -----------------------------------------------------------------------------------------
 * PUT: Review / Decide on an Extension Request
 * -----------------------------------------------------------------------------------------
 * Accessible by: SAFETY_OFFICER or ADMIN.
 * Body: { extensionId: string, decision: "APPROVED" | "REJECTED", comment?: string }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Authenticate user from session cookie
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // 2. Enforce Role: Only Safety Officers or Admins can review extension requests
    if (user.role !== Role.SAFETY_OFFICER && user.role !== Role.ADMIN) {
      return forbiddenResponse("Only Safety Officers or Admins can review extension requests.")
    }

    const { extensionId, decision, comment } = await req.json()

    if (!extensionId || !decision) {
      return NextResponse.json({ error: "extensionId and decision (APPROVED/REJECTED) are required" }, { status: 400 })
    }

    // 3. Fetch extension request with parent permit data
    const extension = await prisma.extensionRequest.findUnique({
      where: { id: extensionId },
      include: { permit: { include: { requester: true } } },
    })

    if (!extension || extension.permitId !== params.id) {
      return NextResponse.json({ error: "Extension request not found" }, { status: 404 })
    }

    // Ensure it hasn't already been reviewed
    if (extension.status !== ExtensionStatus.PENDING) {
      return NextResponse.json({ error: "This extension request has already been reviewed" }, { status: 400 })
    }

    // 4. Enforce Self-Approval Ban:
    // A safety officer cannot approve an extension on a permit they requested.
    if (extension.permit.requesterId === user.userId) {
      return NextResponse.json({ error: "Self-approval ban: You cannot approve an extension on your own permit." }, { status: 403 })
    }

    // 5. Atomic transaction: Update extension, update permit's extendedUntil if approved, log audit
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
        // Base extension time off the existing extendedUntil date, or the initial plannedEnd
        const baseDate = extension.permit.extendedUntil
          ? new Date(extension.permit.extendedUntil)
          : new Date(extension.permit.plannedEnd)
        newExtendedUntil = new Date(baseDate.getTime() + extension.requestedHours * 60 * 60 * 1000)

        // Update the permit's operational deadline
        await tx.permit.update({
          where: { id: extension.permitId },
          data: { extendedUntil: newExtendedUntil },
        })
      }

      // Record audit log entry
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

    // 6. Notify requester of decision
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
