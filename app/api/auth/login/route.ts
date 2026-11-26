/**
 * ============================================================================
 * AUTHENTICATION LOGIN ENDPOINT (/api/auth/login)
 * ============================================================================
 * Verifies email and salted bcrypt password hash, generates a signed 24h JWT
 * containing identity and assignedAreaIds (eliminating future DB lookups),
 * and sets an HTTP-only secure cookie in the client browser.
 */

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signToken, AUTH_COOKIE_NAME } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // Optimized select: retrieve only needed fields
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Preload assignedAreaIds into the JWT so subsequent API calls don't query the DB
    let assignedAreaIds: string[] = []
    if (user.role === Role.AREA_OWNER || user.role === Role.ADMIN) {
      const userAreas = await prisma.userArea.findMany({
        where: { userId: user.id },
        select: { areaId: true },
      })
      assignedAreaIds = userAreas.map((ua) => ua.areaId)
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      assignedAreaIds,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedAreaIds,
      },
    })

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return response
  } catch (err: any) {
    console.error("Login error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
