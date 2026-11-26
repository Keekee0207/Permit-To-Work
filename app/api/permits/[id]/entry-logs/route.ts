/**
 * =========================================================================================
 * CONFINED SPACE PERSONNEL ENTRY & EXIT LOGGER (API ROUTE)
 * =========================================================================================
 * Path: /api/permits/[id]/entry-logs
 * Method: POST
 *
 * PURPOSE & INDUSTRIAL COMPLIANCE:
 * Under OSHA 1910.146 and Factories Act 1948 regulations, entering a Permit-Required
 * Confined Space (e.g. storage tanks, reaction vessels, silos, boiler drums) requires
 * continuous accounting of all entrants at the portal.
 *
 * KEY RULES ENFORCED:
 * 1. Permit Type Check:
 *    - Only permits with type CONFINED_SPACE are allowed to record entry/exit logs.
 * 2. Hard Rule 4 (Active Status Only):
 *    - Personnel CANNOT enter or exit a space unless the permit status is strictly ACTIVE
 *      and within its valid time window (not expired).
 * 3. Two Logging Actions:
 *    - "ENTRY": Logs a new entrant with personName, badgeNumber, and entry timestamp.
 *    - "EXIT": Locates an open entry log record by logId and timestamps their exit.
 * 4. Immutable Audit Trail:
 *    - Every entry and exit generates an immutable AuditLog entry recording who logged the action.
 * =========================================================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitStateMachine } from "@/lib/permitStateMachine"
import { PermitType } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // -------------------------------------------------------------------------------------
    // 1. AUTHENTICATION CHECK
    // Verify that the user has a valid authenticated JWT session cookie.
    // -------------------------------------------------------------------------------------
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // -------------------------------------------------------------------------------------
    // 2. FETCH TARGET PERMIT
    // Retrieve the permit by ID from Neon PostgreSQL.
    // -------------------------------------------------------------------------------------
    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    // -------------------------------------------------------------------------------------
    // 3. PERMIT TYPE VALIDATION
    // Verify that this is indeed a CONFINED_SPACE permit before allowing entry/exit logging.
    // -------------------------------------------------------------------------------------
    if (permit.type !== PermitType.CONFINED_SPACE) {
      return NextResponse.json({ error: "Entry/exit logs are only applicable for CONFINED_SPACE permits" }, { status: 400 })
    }

    // -------------------------------------------------------------------------------------
    // 4. HARD RULE 4: STATE & EXPIRATION CHECK
    // Confined space entry/exit logs are strictly blocked unless the permit is ACTIVE
    // and within its scheduled or extended work time window.
    // -------------------------------------------------------------------------------------
    const check = PermitStateMachine.canAddEntryExitLog({
      permit,
      currentUser: { id: user.userId, role: user.role },
      now: new Date(),
    })

    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    // -------------------------------------------------------------------------------------
    // 5. PARSE ACTION PAYLOAD
    // Read the entrant details or exit reference.
    // -------------------------------------------------------------------------------------
    const body = await req.json()
    const { action, logId, personName, badgeNumber, entryTime, exitTime } = body

    // Retrieve existing logs from the JSON column typeSpecificData
    const typeData = (permit.typeSpecificData as any) || {}
    const logs = Array.isArray(typeData.entryExitLog) ? [...typeData.entryExitLog] : []

    // -------------------------------------------------------------------------------------
    // 6. PROCESS ACTION: "ENTRY" OR "EXIT"
    // -------------------------------------------------------------------------------------
    if (action === "ENTRY") {
      // Validate required entrant details
      if (!personName || !badgeNumber) {
        return NextResponse.json({ error: "Person name and badge number are required" }, { status: 400 })
      }
      const newEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        personName,
        badgeNumber,
        entryTime: entryTime || new Date().toISOString(),
        exitTime: null, // Remains null until they exit
      }
      logs.push(newEntry)
    } else if (action === "EXIT") {
      // Validate that an existing log record ID was specified
      if (!logId) {
        return NextResponse.json({ error: "logId is required for exit logging" }, { status: 400 })
      }
      const entry = logs.find((l: any) => l.id === logId)
      if (entry) {
        entry.exitTime = exitTime || new Date().toISOString()
      } else {
        return NextResponse.json({ error: "Entry record not found" }, { status: 404 })
      }
    }

    const updatedData = { ...typeData, entryExitLog: logs }

    // -------------------------------------------------------------------------------------
    // 7. ATOMIC TRANSACTION: UPDATE PERMIT & CREATE AUDIT LOG
    // -------------------------------------------------------------------------------------
    const updated = await prisma.$transaction(async (tx) => {
      // Update permit's typeSpecificData JSON column
      const p = await tx.permit.update({
        where: { id: permit.id },
        data: { typeSpecificData: updatedData },
      })

      // Write regulatory audit entry
      await tx.auditLog.create({
        data: {
          permitId: permit.id,
          actorId: user.userId,
          action: action === "ENTRY" ? "CONFINED_SPACE_ENTRY" : "CONFINED_SPACE_EXIT",
          comment:
            action === "ENTRY"
              ? `Personnel entry logged: ${personName} (Badge #${badgeNumber})`
              : `Personnel exit logged for badge ${logs.find((l: any) => l.id === logId)?.badgeNumber}`,
        },
      })

      return p
    })

    return NextResponse.json({ success: true, permit: updated, entryExitLog: logs })
  } catch (err: any) {
    console.error("Entry/Exit log error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
