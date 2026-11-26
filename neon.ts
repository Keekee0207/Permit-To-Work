/**
 * =========================================================================================
 * NEON SERVERLESS POSTGRESQL CONFIGURATION
 * =========================================================================================
 * Path: neon.ts
 *
 * PURPOSE:
 * Configures branch policies and database options for Neon Serverless PostgreSQL.
 * Neon provides instant database branching, allowing ephemeral development/staging
 * branches that mirror production data schemas without additional compute costs.
 *
 * BRANCH POLICIES:
 * - Default branch (production `neondb`): No overrides; keeps persistent long-term storage.
 * - Ephemeral non-default preview branches: Automatically expire with a 7-day TTL (`ttl: "7d"`).
 * =========================================================================================
 */

import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Built-in Neon Auth disabled (using custom Jose JWT cookie authentication)
  auth: false,

  // Branch lifecycle management
  branch: (branch) => {
    if (branch.isDefault) {
      // Production primary branch: persistent
      return {};
    }
    if (!branch.exists) {
      // Automatically expire temporary review/feature branches after 7 days
      return { ttl: "7d" };
    }
    return {};
  },
});
