import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()
    if (user.role !== Role.ADMIN) return forbiddenResponse()

    const [plants, areas, equipment, users] = await Promise.all([
      prisma.plant.findMany({ include: { areas: true }, orderBy: { name: "asc" } }),
      prisma.area.findMany({ include: { plant: true, equipment: true, assignedUsers: { include: { user: true } } }, orderBy: { name: "asc" } }),
      prisma.equipment.findMany({ include: { area: { include: { plant: true } } }, orderBy: { tagCode: "asc" } }),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          assignedAreas: { include: { area: true } },
          createdAt: true,
        },
        orderBy: { name: "asc" },
      }),
    ])

    return NextResponse.json({ plants, areas, equipment, users })
  } catch (err: any) {
    console.error("Admin GET error:", err)
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()
    if (user.role !== Role.ADMIN) return forbiddenResponse()

    const body = await req.json()
    const { resourceType, data } = body

    if (resourceType === "PLANT") {
      const plant = await prisma.plant.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          location: data.location,
        },
      })
      return NextResponse.json({ plant }, { status: 201 })
    }

    if (resourceType === "AREA") {
      const area = await prisma.area.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          plantId: data.plantId,
        },
      })
      return NextResponse.json({ area }, { status: 201 })
    }

    if (resourceType === "EQUIPMENT") {
      const equipment = await prisma.equipment.create({
        data: {
          name: data.name,
          tagCode: data.tagCode.toUpperCase(),
          areaId: data.areaId,
          description: data.description || null,
        },
      })
      return NextResponse.json({ equipment }, { status: 201 })
    }

    if (resourceType === "USER") {
      const passwordHash = await bcrypt.hash(data.password || "Password@123", 10)
      const newUser = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase().trim(),
          role: data.role as Role,
          passwordHash,
        },
      })

      if (data.areaIds && Array.isArray(data.areaIds) && data.areaIds.length > 0) {
        await prisma.userArea.createMany({
          data: data.areaIds.map((areaId: string) => ({
            userId: newUser.id,
            areaId,
          })),
        })
      }

      return NextResponse.json({ user: newUser }, { status: 201 })
    }

    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 })
  } catch (err: any) {
    console.error("Admin POST error:", err)
    return NextResponse.json({ error: err.message || "Failed to create resource" }, { status: 500 })
  }
}
