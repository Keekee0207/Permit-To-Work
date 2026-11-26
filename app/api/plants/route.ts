/**
 * =========================================================================================
 * PLANT & AREA HIERARCHY SELECTOR (API ROUTE)
 * =========================================================================================
 * Path: /api/plants
 * Method: GET
 *
 * PURPOSE:
 * Provides the hierarchical manufacturing facility tree (Plant -> Areas -> Equipment)
 * used by frontend permit forms and filter dropdowns.
 *
 * PERFORMANCE:
 * Uses Edge Cache-Control headers (s-maxage=300, stale-while-revalidate=600) so Vercel's
 * Edge network serves requests in <20ms without querying Neon DB repeatedly.
 * =========================================================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user session
    const user = await getSessionUser(req)
    if (!user) return unauthorizedResponse()

    // 2. Fetch all plants sorted alphabetically with nested areas and equipment
    const plants = await prisma.plant.findMany({
      include: {
        areas: {
          include: {
            equipment: true, // Include tag codes and equipment names
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(
      { plants },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch (err: any) {
    console.error("Plants API error:", err)
    return NextResponse.json({ error: "Failed to load hierarchy" }, { status: 500 })
  }
}
