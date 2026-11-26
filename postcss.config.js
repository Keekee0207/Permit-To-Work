/**
 * =========================================================================================
 * POSTCSS PIPELINE CONFIGURATION
 * =========================================================================================
 * Path: postcss.config.js
 *
 * PURPOSE:
 * Processes Tailwind CSS rules and generates browser-compatible CSS vendor prefixes
 * via Autoprefixer during build and development.
 * =========================================================================================
 */

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
