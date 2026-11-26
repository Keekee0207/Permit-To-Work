/**
 * =========================================================================================
 * AUTOMATED PERMIT EXPIRATION CRON TRIGGER (API ROUTE)
 * =========================================================================================
 * Path: /api/cron/expire
 * Methods: GET, POST
 *
 * PURPOSE & INDUSTRIAL TIMING:
 * In high-hazard industrial plants, work permits have strict time-based validity.
 * If a permit reaches its scheduled end (plannedEnd or extendedUntil) while still in
 * an open state (e.g., ACTIVE or APPROVED), it must automatically lapse into EXPIRED
 * status so unauthorized hazardous work cannot continue past the approved safety window.
 *
 * HOW IT WORKS:
 * - This endpoint can be invoked by an external scheduler (e.g. AWS EventBridge, Vercel Cron,
 *   or a Kubernetes CronJob) periodically (e.g., every 5 minutes).
 * - Internally invokes `triggerLazyExpiry()` from `lib/expiryService.ts`, which evaluates all
 *   time-exceeded permits, transitions them to EXPIRED, and records audit logs.
 * =========================================================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { triggerLazyExpiry } from "@/lib/expiryService"

export async function GET(req: NextRequest) {
  try {
    // Execute lazy expiry sweep across all active and approved permits in the database
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

// Allow external schedulers that invoke via POST to trigger the same expiry sweep
export async function POST(req: NextRequest) {
  return GET(req)
}
