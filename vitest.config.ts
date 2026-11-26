/**
 * =========================================================================================
 * VITEST UNIT TESTING CONFIGURATION
 * =========================================================================================
 * Path: vitest.config.ts
 * Execution: npm test (or npx vitest)
 *
 * PURPOSE:
 * Configures the fast unit test runner for business logic validation, state machine tests,
 * and safety constraint verification.
 * - environment: "node" simulates Node.js runtime for backend logic and services.
 * - globals: true exposes describe, it, expect globally.
 * - alias: Maps "@/" to root directory for consistent import resolution.
 * =========================================================================================
 */

import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
