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
 * DATA RELATIONSHIP:
 * Plant (e.g., Chennai Heavy Engineering Plant 1)
 *   └── Area (e.g., Boiler & Steam Utility Area)
 *         └── Equipment (e.g., High-Pressure Steam Boiler #1)
 *
 * ACCESS CONTROL:
 * Requires an authenticated user session (any valid role can read plants to raise or filter permits).
 * =========================================================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, unauthorizedResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    return NextResponse.json({ plants })
  } catch (err: any) {
    console.error("Plants API error:", err)
    return NextResponse.json({ error: "Failed to load hierarchy" }, { status: 500 })
  }
}
