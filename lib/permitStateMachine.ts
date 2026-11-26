/**
 * ============================================================================
 * PERMIT LIFECYCLE FINITE STATE MACHINE (FSM)
 * ============================================================================
 * Implements deterministic transition rules, role-based signing rules,
 * non-self-approval enforcement, and state validation across all 8 permit states:
 * 
 * DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> SUSPENDED -> ACTIVE -> CLOSED -> CLOSED_VERIFIED
 *   |               |            |         |            |
 *   +---------------+------------+---------+------------+---> CANCELLED / EXPIRED
 */

import { Permit, PermitStatus, Role, ApprovalDecision, PermitApproval, User, Area, ExtensionRequest, AuditLog } from "@prisma/client"
import { notifyStub } from "./notifyStub"

export interface StateMachineContext {
  permit: Permit & {
    approvals?: (PermitApproval & { approver?: User | null })[]
    area?: (Area & { assignedUsers?: { userId: string }[] }) | null
    extensions?: ExtensionRequest[]
  }
  currentUser: {
    id: string
    role: Role
    name?: string
    assignedAreaIds?: string[]
  }
  now?: Date
}

export interface TransitionResult {
  allowed: boolean
  targetStatus?: PermitStatus
  error?: string
  auditAction?: string
  auditDetails?: {
    action: string
    fromValue: string
    toValue: string
    comment?: string
  }
}

/**
 * Check and compute auto-expiry status for a permit.
 * A permit in PENDING_APPROVAL or ACTIVE expires if now > (extendedUntil ?? plannedEnd).
 */
export function isPermitExpired(
  permit: Pick<Permit, "status" | "plannedEnd" | "extendedUntil">,
  now: Date = new Date()
): boolean {
  if (permit.status !== PermitStatus.PENDING_APPROVAL && permit.status !== PermitStatus.ACTIVE) {
    return false
  }
  const effectiveEnd = permit.extendedUntil ?? permit.plannedEnd
  return now.getTime() > new Date(effectiveEnd).getTime()
}

/**
 * Core validation checks for state transitions in the Permit lifecycle
 */
export class PermitStateMachine {
  /**
   * Submit a DRAFT permit -> PENDING_APPROVAL
   */
  static canSubmit(ctx: StateMachineContext): TransitionResult {
    const { permit, currentUser } = ctx

    if (permit.status !== PermitStatus.DRAFT) {
      return { allowed: false, error: `Only permits in DRAFT status can be submitted. Current status is ${permit.status}.` }
    }

    if (currentUser.role === Role.REQUESTER && permit.requesterId !== currentUser.id) {
      return { allowed: false, error: "You can only submit your own permit requests." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.PENDING_APPROVAL,
      auditAction: "SUBMITTED",
      auditDetails: {
        action: "STATUS_CHANGE",
        fromValue: PermitStatus.DRAFT,
        toValue: PermitStatus.PENDING_APPROVAL,
        comment: "Permit submitted for Area Owner and Safety Officer approval.",
      },
    }
  }

  /**
   * Process an approval or rejection on PENDING_APPROVAL
   */
  static canReviewApproval(
    ctx: StateMachineContext,
    decision: ApprovalDecision,
    comment?: string
  ): TransitionResult {
    const { permit, currentUser, now = new Date() } = ctx

    if (permit.status !== PermitStatus.PENDING_APPROVAL) {
      return { allowed: false, error: `Permit is not pending approval (current: ${permit.status}).` }
    }

    // Auto-expiry check
    if (isPermitExpired(permit, now)) {
      return { allowed: false, error: "This permit has expired and can no longer be approved or rejected." }
    }

    // Rule: Self-Approval Ban - A user can NEVER approve their own permit, even if ADMIN, SAFETY_OFFICER, or AREA_OWNER
    if (permit.requesterId === currentUser.id) {
      return {
        allowed: false,
        error: "Self-approval is strictly forbidden. You cannot approve or reject a permit you requested.",
      }
    }

    // Rule: Admin cannot approve in the place of Area Owner or Safety Officer
    if (currentUser.role === Role.ADMIN) {
      return {
        allowed: false,
        error: "Admins cannot sign approvals in place of Area Owners or Safety Officers. Multi-tier safety sign-offs require the designated field roles.",
      }
    }

    // Rule: Requester cannot approve anything
    if (currentUser.role === Role.REQUESTER) {
      return { allowed: false, error: "Requesters are not authorized to approve permits." }
    }

    // Rule: Rejection requires a mandatory reason
    if (decision === ApprovalDecision.REJECTED && (!comment || comment.trim().length === 0)) {
      return { allowed: false, error: "A mandatory comment/reason is required when rejecting a permit." }
    }

    // Rule: AREA_OWNER can only review if assigned to permit's area
    if (currentUser.role === Role.AREA_OWNER) {
      const isAssigned = currentUser.assignedAreaIds?.includes(permit.areaId) ||
        permit.area?.assignedUsers?.some((u) => u.userId === currentUser.id)
      if (!isAssigned) {
        return {
          allowed: false,
          error: "Area Owners can only approve permits within their specifically assigned plant areas.",
        }
      }
    }

    if (decision === ApprovalDecision.REJECTED) {
      return {
        allowed: true,
        targetStatus: PermitStatus.REJECTED,
        auditAction: "REJECTED",
        auditDetails: {
          action: "REJECTED",
          fromValue: PermitStatus.PENDING_APPROVAL,
          toValue: PermitStatus.REJECTED,
          comment: comment?.trim() || "Permit rejected by approver.",
        },
      }
    }

    // For APPROVAL: check if all required approvers will be satisfied
    const approvals = permit.approvals || []
    
    // Check which approval slot this user satisfies
    let satisfiesRole: Role | null = null
    if (currentUser.role === Role.SAFETY_OFFICER) {
      satisfiesRole = Role.SAFETY_OFFICER
    } else if (currentUser.role === Role.AREA_OWNER) {
      satisfiesRole = Role.AREA_OWNER
    }

    if (!satisfiesRole) {
      return { allowed: false, error: "User role does not match any required permit approver." }
    }

    // Check if the other required approver is already approved
    const otherApprovals = approvals.filter((a) => a.requiredRole !== satisfiesRole)
    const otherAllApproved = otherApprovals.length > 0 && otherApprovals.every((a) => a.decision === ApprovalDecision.APPROVED)

    const targetStatus = otherAllApproved ? PermitStatus.APPROVED : PermitStatus.PENDING_APPROVAL

    return {
      allowed: true,
      targetStatus,
      auditAction: "APPROVED_STEP",
      auditDetails: {
        action: "APPROVAL_RECORDED",
        fromValue: permit.status,
        toValue: targetStatus,
        comment: comment?.trim() || `Approved by ${currentUser.role} (${currentUser.name || currentUser.id})`,
      },
    }
  }

  /**
   * Activate an APPROVED permit -> ACTIVE
   */
  static canActivate(ctx: StateMachineContext): TransitionResult {
    const { permit, currentUser, now = new Date() } = ctx

    if (permit.status !== PermitStatus.APPROVED) {
      return { allowed: false, error: `Only APPROVED permits can be activated. Current status is ${permit.status}.` }
    }

    // Hard Rule 1: Cannot go ACTIVE unless every required approver (AREA_OWNER + SAFETY_OFFICER) has approved
    const approvals = permit.approvals || []
    const hasAreaOwnerApproved = approvals.some(
      (a) => a.requiredRole === Role.AREA_OWNER && a.decision === ApprovalDecision.APPROVED
    )
    const hasSafetyOfficerApproved = approvals.some(
      (a) => a.requiredRole === Role.SAFETY_OFFICER && a.decision === ApprovalDecision.APPROVED
    )

    if (!hasAreaOwnerApproved || !hasSafetyOfficerApproved) {
      return {
        allowed: false,
        error: "Cannot activate permit: All required approvers (Area Owner and Safety Officer) must approve first.",
      }
    }

    // Hard Rule 2: Cannot go ACTIVE before plannedStart
    const plannedStart = new Date(permit.plannedStart)
    if (now.getTime() < plannedStart.getTime()) {
      return {
        allowed: false,
        error: `Cannot activate permit before scheduled plannedStart time (${plannedStart.toISOString()}).`,
      }
    }

    // Check expiry
    if (isPermitExpired(permit, now)) {
      return { allowed: false, error: "Cannot activate: The permit validity window has already expired." }
    }

    // Only requester, safety officer, or admin can activate
    if (currentUser.role === Role.REQUESTER && permit.requesterId !== currentUser.id) {
      return { allowed: false, error: "Only the permit requester, safety officer, or admin can activate this permit." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.ACTIVE,
      auditAction: "ACTIVATED",
      auditDetails: {
        action: "STATUS_CHANGE",
        fromValue: PermitStatus.APPROVED,
        toValue: PermitStatus.ACTIVE,
        comment: "Work permit activated on shop floor. Work may commence.",
      },
    }
  }

  /**
   * Suspend an ACTIVE permit -> SUSPENDED
   * Only Safety Officer or Admin can suspend
   */
  static canSuspend(ctx: StateMachineContext, reason: string): TransitionResult {
    const { permit, currentUser } = ctx

    if (permit.status !== PermitStatus.ACTIVE) {
      return { allowed: false, error: `Only ACTIVE permits can be suspended. Current status is ${permit.status}.` }
    }

    if (currentUser.role !== Role.SAFETY_OFFICER && currentUser.role !== Role.ADMIN) {
      return { allowed: false, error: "Only Safety Officers and Admins have authority to suspend active permits." }
    }

    if (!reason || reason.trim().length === 0) {
      return { allowed: false, error: "A suspension reason is mandatory (e.g. unsafe conditions, weather, gas alarm)." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.SUSPENDED,
      auditAction: "SUSPENDED",
      auditDetails: {
        action: "SUSPENDED",
        fromValue: PermitStatus.ACTIVE,
        toValue: PermitStatus.SUSPENDED,
        comment: reason.trim(),
      },
    }
  }

  /**
   * Resume a SUSPENDED permit -> ACTIVE
   * Only Safety Officer or Admin can resume
   */
  static canResume(ctx: StateMachineContext, reason?: string): TransitionResult {
    const { permit, currentUser, now = new Date() } = ctx

    if (permit.status !== PermitStatus.SUSPENDED) {
      return { allowed: false, error: `Only SUSPENDED permits can be resumed. Current status is ${permit.status}.` }
    }

    if (currentUser.role !== Role.SAFETY_OFFICER && currentUser.role !== Role.ADMIN) {
      return { allowed: false, error: "Only Safety Officers and Admins can resume suspended permits." }
    }

    if (isPermitExpired(permit, now)) {
      return { allowed: false, error: "Cannot resume: Permit has expired while suspended." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.ACTIVE,
      auditAction: "RESUMED",
      auditDetails: {
        action: "RESUMED",
        fromValue: PermitStatus.SUSPENDED,
        toValue: PermitStatus.ACTIVE,
        comment: reason?.trim() || "Permit resumed after safety condition cleared.",
      },
    }
  }

  /**
   * Close an ACTIVE permit -> CLOSED
   * Marked complete by Requester, Safety Officer, or Admin
   */
  static canClose(ctx: StateMachineContext, completionNotes?: string): TransitionResult {
    const { permit, currentUser } = ctx

    if (permit.status !== PermitStatus.ACTIVE) {
      return { allowed: false, error: `Only ACTIVE permits can be marked closed by requester. Current status is ${permit.status}.` }
    }

    if (currentUser.role === Role.REQUESTER && permit.requesterId !== currentUser.id) {
      return { allowed: false, error: "You can only close your own active permits." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.CLOSED,
      auditAction: "CLOSED",
      auditDetails: {
        action: "CLOSED",
        fromValue: PermitStatus.ACTIVE,
        toValue: PermitStatus.CLOSED,
        comment: completionNotes?.trim() || "Work declared finished by requester/team.",
      },
    }
  }

  /**
   * Verify closure: CLOSED -> CLOSED_VERIFIED
   * Hard Rule 8: Safety Officer performs closure verification
   */
  static canVerifyClosure(ctx: StateMachineContext, verificationNotes?: string): TransitionResult {
    const { permit, currentUser } = ctx

    if (permit.status !== PermitStatus.CLOSED) {
      return { allowed: false, error: `Only permits in CLOSED status can be verified. Current status is ${permit.status}.` }
    }

    if (currentUser.role !== Role.SAFETY_OFFICER && currentUser.role !== Role.ADMIN) {
      return { allowed: false, error: "Only Safety Officers and Admins can perform closure verification." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.CLOSED_VERIFIED,
      auditAction: "CLOSED_VERIFIED",
      auditDetails: {
        action: "CLOSED_VERIFIED",
        fromValue: PermitStatus.CLOSED,
        toValue: PermitStatus.CLOSED_VERIFIED,
        comment: verificationNotes?.trim() || "Safety Officer verified site is clean, de-isolated, and safe.",
      },
    }
  }

  /**
   * Cancel any non-terminal permit
   */
  static canCancel(ctx: StateMachineContext, reason: string): TransitionResult {
    const { permit, currentUser } = ctx

    const nonTerminalStatuses: PermitStatus[] = [
      PermitStatus.DRAFT,
      PermitStatus.PENDING_APPROVAL,
      PermitStatus.APPROVED,
      PermitStatus.ACTIVE,
      PermitStatus.SUSPENDED,
    ]

    if (!nonTerminalStatuses.includes(permit.status)) {
      return {
        allowed: false,
        error: `Permit in ${permit.status} is in a terminal state and cannot be cancelled.`,
      }
    }

    if (currentUser.role === Role.REQUESTER && permit.requesterId !== currentUser.id) {
      return { allowed: false, error: "You can only cancel your own permits." }
    }

    if (!reason || reason.trim().length === 0) {
      return { allowed: false, error: "Cancellation requires a mandatory reason." }
    }

    return {
      allowed: true,
      targetStatus: PermitStatus.CANCELLED,
      auditAction: "CANCELLED",
      auditDetails: {
        action: "CANCELLED",
        fromValue: permit.status,
        toValue: PermitStatus.CANCELLED,
        comment: reason.trim(),
      },
    }
  }

  /**
   * Request a time extension on an ACTIVE permit
   * Capped to max 4 hours per request, max 2 total extensions
   */
  static canRequestExtension(
    ctx: StateMachineContext,
    requestedHours: number,
    reason: string
  ): TransitionResult {
    const { permit, currentUser, now = new Date() } = ctx

    if (permit.status !== PermitStatus.ACTIVE) {
      return { allowed: false, error: "Extensions can only be requested for ACTIVE permits." }
    }

    if (currentUser.role === Role.REQUESTER && permit.requesterId !== currentUser.id) {
      return { allowed: false, error: "Only the permit requester or team can request an extension." }
    }

    if (isPermitExpired(permit, now)) {
      return { allowed: false, error: "Cannot extend an expired permit. Please raise a new permit." }
    }

    if (requestedHours <= 0 || requestedHours > 4) {
      return { allowed: false, error: "Requested extension duration must be between 1 and 4 hours." }
    }

    if (!reason || reason.trim().length < 5) {
      return { allowed: false, error: "A descriptive reason (at least 5 characters) is required for extension." }
    }

    const approvedExtensionsCount = (permit.extensions || []).filter((e) => e.status === "APPROVED").length
    if (approvedExtensionsCount >= 2) {
      return {
        allowed: false,
        error: "Maximum extension limit reached (2 extensions permitted per work permit). Please raise a new permit.",
      }
    }

    const pendingExtensions = (permit.extensions || []).some((e) => e.status === "PENDING")
    if (pendingExtensions) {
      return { allowed: false, error: "An extension request is already pending review for this permit." }
    }

    return { allowed: true }
  }

  /**
   * Confined Space entry/exit log rule: Hard Rule 4
   * Work or Confined Space logs cannot be added unless the permit is ACTIVE
   */
  static canAddEntryExitLog(ctx: StateMachineContext): TransitionResult {
    const { permit, now = new Date() } = ctx

    if (permit.status !== PermitStatus.ACTIVE) {
      return {
        allowed: false,
        error: `Confined space entry/exit logs can only be recorded when the permit is ACTIVE. Current status is ${permit.status}.`,
      }
    }

    if (isPermitExpired(permit, now)) {
      return { allowed: false, error: "Cannot log entry: Permit has expired." }
    }

    return { allowed: true }
  }
}
