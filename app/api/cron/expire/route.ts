import { NextRequest, NextResponse } from "next/server"
import { triggerLazyExpiry } from "@/lib/expiryService"

export async function GET(req: NextRequest) {
  try {
    const expiredCount = await triggerLazyExpiry()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      expiredCount,
      message: `Lazy expiry evaluated: ${expiredCount} permits moved to EXPIRED.`,
    })
  } catch (err: any) {
    console.error("Cron expiry error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
