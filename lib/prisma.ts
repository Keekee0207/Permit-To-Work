/**
 * ============================================================================
 * PRISMA ORM CLIENT SINGLETON
 * ============================================================================
 * Ensures a single shared PrismaClient instance is reused across hot reloads
 * in development and warm lambda container executions on Vercel serverless,
 * preventing connection pool exhaustion and reconnection latency on PostgreSQL (Neon).
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

// Preserve client on globalThis across all environments (both dev hot-reload & serverless warm lambdas)
globalForPrisma.prisma = prisma
