/**
 * ============================================================================
 * PERMIT STATE MACHINE & ACTION DISPATCHER (/api/permits/[id]/actions)
 * ============================================================================
 * Handles all authorized permit lifecycle actions:
 * - SUBMIT: Moves DRAFT -> PENDING_APPROVAL.
 * - REVIEW_APPROVAL: Area Owner / Safety Officer records APPROVED / REJECTED decision + digital signature.
 * - ACTIVATE: Once both approvals are approved, transitions permit to ACTIVE.
 * - SUSPEND: Temporarily pauses ongoing work for safety reasons.
 * - RESUME: Resumes suspended work back to ACTIVE.
 * - CLOSE: Field requester marks work completed and site cleared.
 * - VERIFY_CLOSURE: Area Owner confirms physical site inspection -> CLOSED_VERIFIED.
 * - CANCEL: Cancels unneeded or conflicting permits.
 *
 * All state mutations are performed inside an atomic Prisma $transaction
 * accompanied by immutable audit log generation.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitStateMachine, isPermitExpired } from "@/lib/permitStateMachine"
import { triggerLazyExpiry } from "@/lib/expiryService"
import { ApprovalDecision, Role, PermitStatus } from "@prisma/client"
import { notifyStub } from "@/lib/notifyStub"
import { getPermitTypeConfig } from "@/lib/permitTypeConfig"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // Ensure expired permits are lazily flagged before running action
    await triggerLazyExpiry()

    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
      include: {
        approvals: { include: { approver: true } },
        area: { include: { assignedUsers: true } },
        extensions: true,
        requester: true,
      },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    const body = await req.json()
    const { action, decision, comment, signatureDataUrl, reason, completionNotes, verificationNotes } = body

    // Build execution context for the state machine rules engine
    const ctx = {
      permit,
      currentUser: {
        id: user.userId,
        role: user.role,
        name: user.name,
        assignedAreaIds: user.assignedAreaIds,
      },
      now: new Date(),
    }

    let result
    switch (action) {
      case "SUBMIT":
        // Validate typeSpecificData against Zod schema before submitting
        const config = getPermitTypeConfig(permit.type)
        const parsed = config.schema.safeParse(permit.typeSpecificData || {})
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Cannot submit: Incomplete or invalid type-specific safety fields", details: parsed.error.flatten() },
            { status: 400 }
          )
        }
        result = PermitStateMachine.canSubmit(ctx)
        break

      case "REVIEW_APPROVAL":
        // Validates approver role, non-self-approval rule, and decision validity
        result = PermitStateMachine.canReviewApproval(ctx, decision as ApprovalDecision, comment)
        break

      case "ACTIVATE":
        // Can only activate if both Area Owner and Safety Officer have approved
        result = PermitStateMachine.canActivate(ctx)
        break

      case "SUSPEND":
        // Requires mandatory safety reason
        result = PermitStateMachine.canSuspend(ctx, reason)
        break

      case "RESUME":
        result = PermitStateMachine.canResume(ctx, reason)
        break

      case "CLOSE":
        // Requester initiates work completion and cleanup
        result = PermitStateMachine.canClose(ctx, completionNotes)
        break

      case "VERIFY_CLOSURE":
        // Area Owner inspects restored area and verifies closure
        result = PermitStateMachine.canVerifyClosure(ctx, verificationNotes)
        break

      case "CANCEL":
        result = PermitStateMachine.canCancel(ctx, reason)
        break

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    if (!result.allowed) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // ------------------------------------------------------------------------
    // ATOMIC DATABASE TRANSACTION
    // ------------------------------------------------------------------------
    const updatedPermit = await prisma.$transaction(async (tx) => {
      // Step 1: Record approver decision and digital signature
      if (action === "REVIEW_APPROVAL") {
        let targetRole: Role = user.role
        if (user.role === Role.ADMIN) {
          // If admin, identify which approval slot needs filling
          const pendingArea = permit.approvals.find(
            (a) => a.requiredRole === Role.AREA_OWNER && a.decision === ApprovalDecision.PENDING
          )
          targetRole = pendingArea ? Role.AREA_OWNER : Role.SAFETY_OFFICER
        }

        await tx.permitApproval.updateMany({
          where: {
            permitId: permit.id,
            requiredRole: targetRole,
          },
          data: {
            approverId: user.userId,
            decision: decision as ApprovalDecision,
            comment: comment || null,
            signatureDataUrl: signatureDataUrl || null,
            reviewedAt: new Date(),
          },
        })
      }

      // Step 2: Apply target status update if transitioned
      const updateData: any = {}
      if (result.targetStatus && result.targetStatus !== permit.status) {
        updateData.status = result.targetStatus
      }
      if (action === "CLOSE" && completionNotes) {
        updateData.completionNotes = completionNotes
      }

      const p = await tx.permit.update({
        where: { id: permit.id },
        data: updateData,
      })

      // Step 3: Write immutable audit trail entry
      if (result.auditDetails) {
        await tx.auditLog.create({
          data: {
            permitId: permit.id,
            actorId: user.userId,
            action: result.auditDetails.action,
            fromValue: result.auditDetails.fromValue,
            toValue: result.auditDetails.toValue,
            comment: result.auditDetails.comment,
          },
        })
      }

      return p
    })

    // Fire notifications via stub
    notifyStub(
      permit.requester.email,
      `Permit ${permit.permitNumber} status updated: ${result.targetStatus || permit.status}`,
      `Action ${action} executed by ${user.name} (${user.role}).`
    )

    return NextResponse.json({ success: true, permit: updatedPermit, targetStatus: result.targetStatus })
  } catch (err: any) {
    console.error("Action error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
