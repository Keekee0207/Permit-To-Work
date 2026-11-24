import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { prisma } from "./prisma"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "opmaint-default-jwt-secret-key-change-in-prod"
)

export const AUTH_COOKIE_NAME = "opmaint_ptw_session"

export interface JWTPayloadData {
  userId: string
  email: string
  role: Role
  name: string
}

export async function signToken(payload: JWTPayloadData): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayloadData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayloadData
  } catch (err) {
    return null
  }
}

export async function getCurrentUserFromCookie(): Promise<(JWTPayloadData & { assignedAreaIds: string[] }) | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const data = await verifyToken(token)
  if (!data) return null

  // Fetch fresh assigned area IDs for Area Owners
  let assignedAreaIds: string[] = []
  if (data.role === Role.AREA_OWNER || data.role === Role.ADMIN) {
    const userAreas = await prisma.userArea.findMany({
      where: { userId: data.userId },
      select: { areaId: true },
    })
    assignedAreaIds = userAreas.map((ua) => ua.areaId)
  }

  return {
    ...data,
    assignedAreaIds,
  }
}

export async function getSessionUser(req: NextRequest): Promise<(JWTPayloadData & { assignedAreaIds: string[] }) | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const data = await verifyToken(token)
  if (!data) return null

  let assignedAreaIds: string[] = []
  if (data.role === Role.AREA_OWNER || data.role === Role.ADMIN) {
    const userAreas = await prisma.userArea.findMany({
      where: { userId: data.userId },
      select: { areaId: true },
    })
    assignedAreaIds = userAreas.map((ua) => ua.areaId)
  }

  return {
    ...data,
    assignedAreaIds,
  }
}

export function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message: string = "Forbidden: Insufficient privileges") {
  return NextResponse.json({ error: message }, { status: 403 })
}
