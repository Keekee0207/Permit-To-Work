import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, getSessionUser } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({ user })
}

export async function POST(req: NextRequest) {
  // Logout
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
  })
  return response
}
