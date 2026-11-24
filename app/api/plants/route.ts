import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    const plants = await prisma.plant.findMany({
      include: {
        areas: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ plants })
  } catch (err: any) {
    console.error("Plants API error:", err)
    return NextResponse.json({ error: "Failed to load hierarchy" }, { status: 500 })
  }
}
