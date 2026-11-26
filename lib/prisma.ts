/**
 * ============================================================================
 * PRISMA ORM CLIENT SINGLETON
 * ============================================================================
 * Ensures a single shared PrismaClient instance is reused across hot reloads
 * in development, preventing connection pool exhaustion on PostgreSQL (Neon).
 */

import { PrismaClient } from "@prisma/client"

declare global {
  // Global reference attached to NodeJS global scope
  var prisma: PrismaClient | undefined
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

// In development, preserve the client on globalThis to avoid recreating on each code reload
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma
}
