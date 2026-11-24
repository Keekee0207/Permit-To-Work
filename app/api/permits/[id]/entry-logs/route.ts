import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PermitStateMachine } from "@/lib/permitStateMachine"
import { PermitType } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    const permit = await prisma.permit.findUnique({
      where: { id: params.id },
    })

    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 })
    }

    if (permit.type !== PermitType.CONFINED_SPACE) {
      return NextResponse.json({ error: "Entry/exit logs are only applicable for CONFINED_SPACE permits" }, { status: 400 })
    }

    // Hard Rule 4: Work or Confined Space entry/exit logs cannot be added unless permit is ACTIVE
    const check = PermitStateMachine.canAddEntryExitLog({
      permit,
      currentUser: { id: user.userId, role: user.role },
      now: new Date(),
    })

    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const body = await req.json()
    const { action, logId, personName, badgeNumber, entryTime, exitTime } = body

    const typeData = (permit.typeSpecificData as any) || {}
    const logs = Array.isArray(typeData.entryExitLog) ? [...typeData.entryExitLog] : []

    if (action === "ENTRY") {
      if (!personName || !badgeNumber) {
        return NextResponse.json({ error: "Person name and badge number are required" }, { status: 400 })
      }
      const newEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        personName,
        badgeNumber,
        entryTime: entryTime || new Date().toISOString(),
        exitTime: null,
      }
      logs.push(newEntry)
    } else if (action === "EXIT") {
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

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.permit.update({
        where: { id: permit.id },
        data: { typeSpecificData: updatedData },
      })

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
