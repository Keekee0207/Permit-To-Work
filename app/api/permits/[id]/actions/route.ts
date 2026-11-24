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

    await triggerLazyExpiry(params.id)

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
        // Validate typeSpecificData before submitting
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
        result = PermitStateMachine.canReviewApproval(ctx, decision as ApprovalDecision, comment)
        break

      case "ACTIVATE":
        result = PermitStateMachine.canActivate(ctx)
        break

      case "SUSPEND":
        result = PermitStateMachine.canSuspend(ctx, reason)
        break

      case "RESUME":
        result = PermitStateMachine.canResume(ctx, reason)
        break

      case "CLOSE":
        result = PermitStateMachine.canClose(ctx, completionNotes)
        break

      case "VERIFY_CLOSURE":
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

    // Apply database updates in transaction
    const updatedPermit = await prisma.$transaction(async (tx) => {
      // 1. If this was an approval or rejection, update PermitApproval record
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

      // 2. Update permit status if targetStatus changed
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

      // 3. Write immutable audit log
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
