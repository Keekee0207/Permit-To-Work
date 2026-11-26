/**
 * ============================================================================
 * AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) UTILITY
 * ============================================================================
 * Handles JWT token signing, verification, HTTP-only cookie extraction,
 * and role-based privilege checks using the standard `jose` cryptographic library.
 */

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { prisma } from "./prisma"

// Secret key for HMAC-SHA256 signature verification
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "opmaint-default-jwt-secret-key-change-in-prod"
)

// Name of the secure session cookie stored in the browser
export const AUTH_COOKIE_NAME = "opmaint_ptw_session"

// Structure of user claims embedded inside the signed JWT
export interface JWTPayloadData {
  userId: string
  email: string
  role: Role
  name: string
  assignedAreaIds?: string[]
}

/**
 * Generates and cryptographically signs a 24-hour JWT session token
 */
export async function signToken(payload: JWTPayloadData): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET)
}

/**
 * Decodes and verifies the signature and validity of a JWT token string
 */
export async function verifyToken(token: string): Promise<JWTPayloadData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayloadData
  } catch (err) {
    return null
  }
}

/**
 * Server Component Helper: Reads the auth cookie and returns the active user
 * along with their authorized plant area assignments.
 * Optimized: Uses in-token assignedAreaIds if present, avoiding redundant DB queries.
 */
export async function getCurrentUserFromCookie(): Promise<(JWTPayloadData & { assignedAreaIds: string[] }) | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const data = await verifyToken(token)
  if (!data) return null

  let assignedAreaIds: string[] = data.assignedAreaIds || []
  if (!data.assignedAreaIds && (data.role === Role.AREA_OWNER || data.role === Role.ADMIN)) {
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

/**
 * API Route Handler Helper: Inspects incoming HTTP requests, validates the
 * session cookie, and resolves the user identity and assigned plant zones.
 * Optimized: Zero-database query overhead when assignedAreaIds is present in token.
 */
export async function getSessionUser(req: NextRequest): Promise<(JWTPayloadData & { assignedAreaIds: string[] }) | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const data = await verifyToken(token)
  if (!data) return null

  let assignedAreaIds: string[] = data.assignedAreaIds || []
  if (!data.assignedAreaIds && (data.role === Role.AREA_OWNER || data.role === Role.ADMIN)) {
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

/**
 * Returns a standardized 401 Unauthorized JSON response
 */
export function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * Returns a standardized 403 Forbidden JSON response for permission violations
 */
export function forbiddenResponse(message: string = "Forbidden: Insufficient privileges") {
  return NextResponse.json({ error: message }, { status: 403 })
}
