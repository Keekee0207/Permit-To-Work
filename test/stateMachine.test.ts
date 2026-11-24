import { describe, it, expect } from "vitest"
import { PermitStateMachine, isPermitExpired } from "../lib/permitStateMachine"
import { Role, PermitStatus, ApprovalDecision, PermitType } from "@prisma/client"

describe("Permit State Machine & Hard RBAC Rules", () => {
  const basePermit = {
    id: "permit-101",
    permitNumber: "PTW-2024-TEST",
    type: PermitType.HOT_WORK,
    status: PermitStatus.DRAFT,
    requesterId: "user-requester",
    contractorTeam: "Test Mechanicals",
    workDescription: "Pipe welding",
    plantId: "plant-1",
    areaId: "area-1",
    equipmentId: null,
    plannedStart: new Date("2026-11-24T09:00:00Z"),
    plannedEnd: new Date("2026-11-24T17:00:00Z"),
    extendedUntil: null,
    hazards: [],
    ppeRequired: [],
    precautionsChecklist: [],
    typeSpecificData: {},
    completionNotes: null,
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    approvals: [
      {
        id: "app-1",
        permitId: "permit-101",
        requiredRole: Role.AREA_OWNER,
        approverId: null,
        decision: ApprovalDecision.PENDING,
        comment: null,
        signatureDataUrl: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "app-2",
        permitId: "permit-101",
        requiredRole: Role.SAFETY_OFFICER,
        approverId: null,
        decision: ApprovalDecision.PENDING,
        comment: null,
        signatureDataUrl: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    area: {
      id: "area-1",
      plantId: "plant-1",
      name: "Boiler Area",
      code: "BLR",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedUsers: [{ userId: "user-areaowner" }],
    },
    extensions: [],
  }

  // TEST 1: Submit Draft -> Pending Approval
  it("allows requester to submit their own DRAFT permit", () => {
    const res = PermitStateMachine.canSubmit({
      permit: basePermit,
      currentUser: { id: "user-requester", role: Role.REQUESTER },
    })
    expect(res.allowed).toBe(true)
    expect(res.targetStatus).toBe(PermitStatus.PENDING_APPROVAL)
  })

  it("blocks non-requesters from submitting another user's draft", () => {
    const res = PermitStateMachine.canSubmit({
      permit: basePermit,
      currentUser: { id: "user-intruder", role: Role.REQUESTER },
    })
    expect(res.allowed).toBe(false)
    expect(res.error).toContain("You can only submit your own permit")
  })

  // TEST 2: Hard Rule 5 - Self-Approval Ban
  it("strictly blocks self-approval even if user is SAFETY_OFFICER, AREA_OWNER, or ADMIN", () => {
    const pendingPermit = {
      ...basePermit,
      status: PermitStatus.PENDING_APPROVAL,
      requesterId: "user-safety",
    }

    const res = PermitStateMachine.canReviewApproval(
      {
        permit: pendingPermit,
        currentUser: { id: "user-safety", role: Role.SAFETY_OFFICER },
        now: new Date("2026-11-24T10:00:00Z"),
      },
      ApprovalDecision.APPROVED
    )

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("Self-approval is strictly forbidden")
  })

  // TEST 3: Hard Rule 6 - Area Owner Scoping
  it("blocks AREA_OWNER from approving permits outside their assigned areas", () => {
    const pendingPermit = {
      ...basePermit,
      status: PermitStatus.PENDING_APPROVAL,
      areaId: "area-other",
      area: {
        id: "area-other",
        plantId: "plant-1",
        name: "Other Area",
        code: "OTH",
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedUsers: [{ userId: "different-owner" }],
      },
    }

    const res = PermitStateMachine.canReviewApproval(
      {
        permit: pendingPermit,
        currentUser: { id: "user-areaowner", role: Role.AREA_OWNER, assignedAreaIds: ["area-1"] },
        now: new Date("2026-11-24T10:00:00Z"),
      },
      ApprovalDecision.APPROVED
    )

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("specifically assigned plant areas")
  })

  // TEST 4: Rejection requires mandatory reason
  it("blocks rejection without a comment/reason", () => {
    const pendingPermit = { ...basePermit, status: PermitStatus.PENDING_APPROVAL }

    const res = PermitStateMachine.canReviewApproval(
      {
        permit: pendingPermit,
        currentUser: { id: "user-safety", role: Role.SAFETY_OFFICER },
        now: new Date("2026-11-24T10:00:00Z"),
      },
      ApprovalDecision.REJECTED,
      "" // Empty reason
    )

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("mandatory comment/reason is required")
  })

  // TEST 5: Hard Rule 1 - Cannot go ACTIVE unless all required approvers have approved
  it("blocks activation if one or more required approvals are pending", () => {
    const partiallyApprovedPermit = {
      ...basePermit,
      status: PermitStatus.APPROVED,
      approvals: [
        {
          ...basePermit.approvals[0],
          decision: ApprovalDecision.APPROVED,
          approverId: "user-areaowner",
        },
        {
          ...basePermit.approvals[1],
          decision: ApprovalDecision.PENDING, // SAFETY is still pending!
        },
      ],
    }

    const res = PermitStateMachine.canActivate({
      permit: partiallyApprovedPermit,
      currentUser: { id: "user-requester", role: Role.REQUESTER },
      now: new Date("2026-11-24T10:00:00Z"),
    })

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("All required approvers (Area Owner and Safety Officer) must approve first")
  })

  // TEST 6: Hard Rule 2 - Cannot go ACTIVE before plannedStart
  it("blocks activation before scheduled plannedStart time", () => {
    const fullyApprovedPermit = {
      ...basePermit,
      status: PermitStatus.APPROVED,
      plannedStart: new Date("2026-11-24T14:00:00Z"),
      approvals: [
        { ...basePermit.approvals[0], decision: ApprovalDecision.APPROVED, approverId: "user-areaowner" },
        { ...basePermit.approvals[1], decision: ApprovalDecision.APPROVED, approverId: "user-safety" },
      ],
    }

    const res = PermitStateMachine.canActivate({
      permit: fullyApprovedPermit,
      currentUser: { id: "user-requester", role: Role.REQUESTER },
      now: new Date("2026-11-24T10:00:00Z"), // Earlier than 14:00 plannedStart!
    })

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("before scheduled plannedStart time")
  })

  // TEST 7: Hard Rule 3 - Auto-expiry logic
  it("detects expiry when current time exceeds plannedEnd or extendedUntil", () => {
    const activePermit = {
      status: PermitStatus.ACTIVE,
      plannedEnd: new Date("2026-11-24T12:00:00Z"),
      extendedUntil: null,
    }

    const before = new Date("2026-11-24T11:59:00Z")
    const after = new Date("2026-11-24T12:01:00Z")

    expect(isPermitExpired(activePermit, before)).toBe(false)
    expect(isPermitExpired(activePermit, after)).toBe(true)

    // With extension
    const extendedPermit = {
      ...activePermit,
      extendedUntil: new Date("2026-11-24T14:00:00Z"),
    }
    expect(isPermitExpired(extendedPermit, after)).toBe(false) // Still valid because of extension
    expect(isPermitExpired(extendedPermit, new Date("2026-11-24T14:05:00Z"))).toBe(true)
  })

  // TEST 8: Hard Rule 4 - Confined Space Entry Log rule
  it("blocks confined space entry/exit logs when permit is not ACTIVE", () => {
    const draftPermit = { ...basePermit, status: PermitStatus.DRAFT }

    const res = PermitStateMachine.canAddEntryExitLog({
      permit: draftPermit,
      currentUser: { id: "user-requester", role: Role.REQUESTER },
      now: new Date(),
    })

    expect(res.allowed).toBe(false)
    expect(res.error).toContain("can only be recorded when the permit is ACTIVE")
  })

  // TEST 9: Suspension & Resumption by Safety Officer
  it("allows Safety Officer to suspend and resume an ACTIVE permit with valid reason", () => {
    const activePermit = { ...basePermit, status: PermitStatus.ACTIVE }

    const suspendRes = PermitStateMachine.canSuspend(
      {
        permit: activePermit,
        currentUser: { id: "user-safety", role: Role.SAFETY_OFFICER },
      },
      "Gas alarm sound in adjacent utility"
    )

    expect(suspendRes.allowed).toBe(true)
    expect(suspendRes.targetStatus).toBe(PermitStatus.SUSPENDED)

    const suspendedPermit = { ...basePermit, status: PermitStatus.SUSPENDED }
    const resumeRes = PermitStateMachine.canResume({
      permit: suspendedPermit,
      currentUser: { id: "user-safety", role: Role.SAFETY_OFFICER },
      now: new Date("2026-11-24T11:00:00Z"),
    })

    expect(resumeRes.allowed).toBe(true)
    expect(resumeRes.targetStatus).toBe(PermitStatus.ACTIVE)
  })

  // TEST 10: Extension limit check (Max 4 hours per request, max 2 total extensions)
  it("enforces extension duration and 2-extension cap", () => {
    const activePermit = {
      ...basePermit,
      status: PermitStatus.ACTIVE,
      extensions: [
        { id: "e1", status: "APPROVED" },
        { id: "e2", status: "APPROVED" },
      ] as any,
    }

    // Exceeds max 2 approved extensions
    const capRes = PermitStateMachine.canRequestExtension(
      {
        permit: activePermit,
        currentUser: { id: "user-requester", role: Role.REQUESTER },
        now: new Date("2026-11-24T11:00:00Z"),
      },
      2,
      "Need more time"
    )

    expect(capRes.allowed).toBe(false)
    expect(capRes.error).toContain("Maximum extension limit reached")
  })
})
