/**
 * ============================================================================
 * PERMIT TYPE CONFIGURATION & SCHEMA REGISTRY
 * ============================================================================
 * Defines type-specific safety rules, field definitions, standard hazards,
 * required PPE, precautions checklists, and strict Zod validation schemas
 * for all 4 industrial permit types:
 * 1. HOT_WORK (Welding, grinding, cutting, fire watch, gas tests)
 * 2. CONFINED_SPACE (Tanks, vessels, atmospheric O2/LEL/H2S tests, entry logs)
 * 3. WORKING_AT_HEIGHT (Scaffolding, harness inspection, wind speed limit)
 * 4. ELECTRICAL_LOTO (Lockout/Tagout, zero voltage verification, isolation points)
 */

import { z } from "zod"
import { PermitType } from "@prisma/client"

export type FieldInputType = "text" | "number" | "boolean" | "select" | "multiselect" | "time" | "datetime-local" | "json-array"

export interface PermitFieldConfig {
  name: string
  label: string
  type: FieldInputType
  required?: boolean
  description?: string
  options?: { label: string; value: string }[]
  defaultValue?: any
  unit?: string
}

export interface PermitTypeDefinition {
  type: PermitType
  label: string
  badgeColor: string
  description: string
  standardHazards: string[]
  standardPpe: string[]
  standardPrecautions: { id: string; label: string; defaultChecked?: boolean }[]
  fields: PermitFieldConfig[]
  schema: z.ZodObject<any>
}

// 1. HOT_WORK schema
export const hotWorkSchema = z.object({
  hotWorkType: z.enum(["welding", "grinding", "cutting", "soldering"], {
    errorMap: () => ({ message: "Select a valid hot work type (welding, grinding, cutting, soldering)" }),
  }),
  fireWatchAssigned: z.string().min(2, "Fire watch person name is required"),
  fireExtinguisherType: z.string().min(2, "Fire extinguisher type is required (e.g., CO2, Dry Powder, Foam)"),
  combustiblesClearedRadiusMeters: z.number().min(1, "Combustibles clearance radius must be at least 1 meter"),
  gasTestLelPercent: z.number().min(0).max(100, "LEL % must be between 0 and 100"),
  gasTestO2Percent: z.number().min(0).max(30, "O2 % must be between 0 and 30"),
  gasTestTime: z.string().min(1, "Gas test timestamp is required"),
})

// 2. CONFINED_SPACE schema
export const confinedSpaceSchema = z.object({
  spaceId: z.string().min(2, "Vessel / Tank / Confined Space ID is required"),
  entryPoint: z.string().min(2, "Entry point designation is required"),
  o2Percent: z.number().min(0).max(30, "O2 % must be between 0 and 30"),
  lelPercent: z.number().min(0).max(100, "LEL % must be between 0 and 100"),
  h2sPpm: z.number().min(0, "H2S ppm must be positive"),
  coPpm: z.number().min(0, "CO ppm must be positive"),
  atmosphericTestTime: z.string().min(1, "Atmospheric test time is required"),
  standbyAttendantName: z.string().min(2, "Standby attendant name is required"),
  rescuePlan: z.string().min(5, "Emergency rescue plan description is required"),
  ventilationMethod: z.string().min(2, "Ventilation method is required (e.g. Forced Air Blower, Natural)"),
  entryExitLog: z.array(
    z.object({
      id: z.string(),
      personName: z.string(),
      badgeNumber: z.string(),
      entryTime: z.string(),
      exitTime: z.string().optional().nullable(),
    })
  ).default([]),
})

// 3. WORKING_AT_HEIGHT schema
export const workingAtHeightSchema = z.object({
  heightMeters: z.number().min(1.8, "Working at height must be at least 1.8 meters"),
  accessMethod: z.enum(["scaffold", "ladder", "MEWP", "rope"], {
    errorMap: () => ({ message: "Select scaffold, ladder, MEWP, or rope" }),
  }),
  fallArrestEquipment: z.string().min(2, "Full body harness and lifeline details required"),
  anchorPointChecked: z.boolean().refine((val) => val === true, "Anchor point must be inspected and certified"),
  barricadingBelow: z.boolean().refine((val) => val === true, "Ground perimeter barricading is mandatory"),
})

// 4. ELECTRICAL_LOTO schema
export const electricalLotoSchema = z.object({
  equipmentTag: z.string().min(2, "LOTO equipment tag code is required"),
  voltageLevel: z.string().min(2, "Voltage level is required (e.g. 415V, 6.6kV, 11kV)"),
  isolationPoints: z.array(z.string()).min(1, "At least one isolation point is required"),
  lockNumbers: z.string().min(1, "Padlock tag/serial numbers required"),
  tagNumbers: z.string().min(1, "Warning tag numbers required"),
  earthingApplied: z.boolean(),
  testedDeadBy: z.string().min(2, "Name of certified electrician who verified zero energy"),
})

export const PERMIT_TYPE_REGISTRY: Record<PermitType, PermitTypeDefinition> = {
  HOT_WORK: {
    type: "HOT_WORK",
    label: "Hot Work Permit",
    badgeColor: "text-amber-700 bg-amber-50 border-amber-200",
    description: "Welding, flame-cutting, grinding, soldering, or open flame operations.",
    standardHazards: [
      "Fire and Explosion",
      "Sparks and Slag Dispersion",
      "Toxic Fumes and Gases",
      "Combustible Materials in Proximity",
      "Thermal Burns",
    ],
    standardPpe: [
      "Welding Helmet / Face Shield",
      "Leather Welding Gloves",
      "Flame Retardant Apron",
      "Safety Glasses with Side Shields",
      "Steel-Toe Safety Boots",
    ],
    standardPrecautions: [
      { id: "clear_flammables", label: "Flammables and combustibles removed within 10m radius", defaultChecked: true },
      { id: "fire_extinguisher", label: "Fire extinguisher checked, pressurized, and placed on site", defaultChecked: true },
      { id: "fire_blanket", label: "Spark containment blankets placed around work area", defaultChecked: true },
      { id: "fire_watch", label: "Trained continuous fire watch assigned during and 30m post-work", defaultChecked: true },
      { id: "drain_covers", label: "Nearby trenches, sumps, and drains covered with fire blankets", defaultChecked: true },
    ],
    fields: [
      {
        name: "hotWorkType",
        label: "Hot Work Activity Type",
        type: "select",
        required: true,
        options: [
          { label: "Welding (Arc / TIG / MIG)", value: "welding" },
          { label: "Grinding", value: "grinding" },
          { label: "Flame Cutting", value: "cutting" },
          { label: "Soldering / Brazing", value: "soldering" },
        ],
        defaultValue: "welding",
      },
      {
        name: "fireWatchAssigned",
        label: "Designated Fire Watch Person",
        type: "text",
        required: true,
        description: "Full name of the dedicated spotter responsible for spark watch.",
      },
      {
        name: "fireExtinguisherType",
        label: "Extinguisher Type & Size",
        type: "text",
        required: true,
        description: "e.g. 5kg DCP / 4.5kg CO2 placed at scene",
        defaultValue: "DCP 6kg & CO2 4.5kg",
      },
      {
        name: "combustiblesClearedRadiusMeters",
        label: "Combustible Clearance Radius (Meters)",
        type: "number",
        required: true,
        unit: "m",
        defaultValue: 10,
      },
      {
        name: "gasTestLelPercent",
        label: "LEL Gas Concentration (%)",
        type: "number",
        required: true,
        unit: "% LEL",
        defaultValue: 0,
      },
      {
        name: "gasTestO2Percent",
        label: "Oxygen Concentration (%)",
        type: "number",
        required: true,
        unit: "%",
        defaultValue: 20.9,
      },
      {
        name: "gasTestTime",
        label: "Atmospheric Test Timestamp",
        type: "datetime-local",
        required: true,
      },
    ],
    schema: hotWorkSchema,
  },
  CONFINED_SPACE: {
    type: "CONFINED_SPACE",
    label: "Confined Space Entry Permit",
    badgeColor: "text-purple-700 bg-purple-50 border-purple-200",
    description: "Entry into tanks, vessels, silos, pits, sumps, boilers, or manholes.",
    standardHazards: [
      "Oxygen Deficiency (<19.5%) or Enrichment (>23.5%)",
      "Toxic Gas Accumulation (H2S, CO)",
      "Engulfment or Entrapment Hazards",
      "Restricted Ingress and Egress",
      "Flammable Vapors or Dusts",
    ],
    standardPpe: [
      "Multi-Gas Monitor (continuous 4-gas)",
      "Full Body Rescue Harness & Lanyard",
      "Hard Hat with Chin Strap",
      "Chemical / Nitrile Protective Gloves",
      "Emergency Escape Breathing Apparatus (EEBA)",
    ],
    standardPrecautions: [
      { id: "positive_isolation", label: "Lines blinded, double block & bleed, or physically disconnected", defaultChecked: true },
      { id: "continuous_ventilation", label: "Forced air mechanical ventilation running continuously", defaultChecked: true },
      { id: "tripod_winch", label: "Tripod rescue winch set up directly over entry manhole", defaultChecked: true },
      { id: "entry_attendant", label: "Dedicated standby attendant stationed continuously at entry portal", defaultChecked: true },
      { id: "comm_link", label: "Direct two-way voice or radio communication established", defaultChecked: true },
    ],
    fields: [
      {
        name: "spaceId",
        label: "Confined Space / Vessel Identifier",
        type: "text",
        required: true,
        description: "e.g. Reactor Vessel R-201, Storage Tank T-14",
      },
      {
        name: "entryPoint",
        label: "Entry Portal / Manhole Description",
        type: "text",
        required: true,
        description: "e.g. Top 24-inch manhole, Side flange port 3",
      },
      {
        name: "o2Percent",
        label: "Oxygen Level (% O2)",
        type: "number",
        required: true,
        unit: "%",
        defaultValue: 20.8,
      },
      {
        name: "lelPercent",
        label: "Combustible Gas (% LEL)",
        type: "number",
        required: true,
        unit: "% LEL",
        defaultValue: 0,
      },
      {
        name: "h2sPpm",
        label: "Hydrogen Sulfide (H2S ppm)",
        type: "number",
        required: true,
        unit: "ppm",
        defaultValue: 0,
      },
      {
        name: "coPpm",
        label: "Carbon Monoxide (CO ppm)",
        type: "number",
        required: true,
        unit: "ppm",
        defaultValue: 0,
      },
      {
        name: "atmosphericTestTime",
        label: "Pre-Entry Gas Test Time",
        type: "datetime-local",
        required: true,
      },
      {
        name: "standbyAttendantName",
        label: "Standby Attendant Name",
        type: "text",
        required: true,
      },
      {
        name: "rescuePlan",
        label: "Emergency Extraction / Rescue Plan",
        type: "text",
        required: true,
        defaultValue: "Mechanical rescue tripod winch with safety harness retrieval line.",
      },
      {
        name: "ventilationMethod",
        label: "Ventilation Arrangement",
        type: "text",
        required: true,
        defaultValue: "Continuous forced air mechanical blower 1200 CFM.",
      },
    ],
    schema: confinedSpaceSchema,
  },
  WORKING_AT_HEIGHT: {
    type: "WORKING_AT_HEIGHT",
    label: "Working at Height Permit",
    badgeColor: "text-blue-700 bg-blue-50 border-blue-200",
    description: "Tasks elevated at 1.8 meters or higher from ground / permanent deck.",
    standardHazards: [
      "Fall from Height (Personnel)",
      "Falling Tools or Objects onto Personnel Below",
      "Unstable Scaffolding or Access Equipment",
      "Overhead High Voltage Power Lines",
      "Adverse Weather / High Wind Speeds",
    ],
    standardPpe: [
      "Full Body Safety Harness with Double Lanyard & Shock Absorber",
      "Industrial Safety Helmet with Chin Strap",
      "Non-Slip High Traction Safety Boots",
      "Tool Lanyards / Tethered Pouches",
    ],
    standardPrecautions: [
      { id: "scaffold_green_tag", label: "Scaffolding inspected and verified with Green Tag (< 7 days)", defaultChecked: true },
      { id: "ground_barricade", label: "Drop zone below fully barricaded with caution warning tape", defaultChecked: true },
      { id: "anchor_100_percent", label: "100% tie-off to certified overhead anchorage points (>22kN)", defaultChecked: true },
      { id: "tool_tethers", label: "All hand tools secured with wrist or scaffold lanyards", defaultChecked: true },
      { id: "weather_check", label: "Wind speed under 35 km/h with no rain or lightning forecast", defaultChecked: true },
    ],
    fields: [
      {
        name: "heightMeters",
        label: "Maximum Elevation / Height (Meters)",
        type: "number",
        required: true,
        unit: "m",
        defaultValue: 6.5,
      },
      {
        name: "accessMethod",
        label: "Access Equipment",
        type: "select",
        required: true,
        options: [
          { label: "Certified Scaffolding", value: "scaffold" },
          { label: "Mobile Elevated Work Platform (MEWP / Boom)", value: "MEWP" },
          { label: "Heavy-Duty Industrial Ladder", value: "ladder" },
          { label: "Rope Access System", value: "rope" },
        ],
        defaultValue: "scaffold",
      },
      {
        name: "fallArrestEquipment",
        label: "Fall Arrest & Lifeline Specification",
        type: "text",
        required: true,
        defaultValue: "Dual-lanyard shock absorbing harness anchored to 12mm steel lifeline.",
      },
      {
        name: "anchorPointChecked",
        label: "Anchor Point Structural Integrity Verified",
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      {
        name: "barricadingBelow",
        label: "Ground Perimeter Barricading Completed",
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    ],
    schema: workingAtHeightSchema,
  },
  ELECTRICAL_LOTO: {
    type: "ELECTRICAL_LOTO",
    label: "Electrical Isolation & LOTO Permit",
    badgeColor: "text-red-700 bg-red-50 border-red-200",
    description: "Lockout / Tagout, maintenance on switchboards, transformers, and drives.",
    standardHazards: [
      "High Voltage Arc Flash & Blast",
      "Electrocution and Electric Shock",
      "Unexpected Mechanical Start-up / Stored Energy",
      "Residual Capacitor or Inductive Charge",
    ],
    standardPpe: [
      "Arc Flash Protective Suit & Face Shield (Cal/cm2 rated)",
      "Dielectric Electrical Insulating Gloves (Class 0/1/2)",
      "Insulated Safety Footwear (ESR)",
      "Safety Goggles and Cotton Underlayers",
    ],
    standardPrecautions: [
      { id: "main_breaker_open", label: "Primary circuit breaker racking out / isolated", defaultChecked: true },
      { id: "loto_padlocks", label: "Safety padlocks and Danger tags secured on hasp", defaultChecked: true },
      { id: "try_step", label: "Zero-energy verify attempt (push start button to test dead)", defaultChecked: true },
      { id: "calibrated_meter", label: "Multimeter test live-dead-live executed", defaultChecked: true },
      { id: "earth_discharge", label: "Portable earthing lead clamped to busbars where required", defaultChecked: true },
    ],
    fields: [
      {
        name: "equipmentTag",
        label: "Equipment Tag / MCC Panel ID",
        type: "text",
        required: true,
        description: "e.g. MCC-01-FED-04, SUB-A-XFMR-02",
      },
      {
        name: "voltageLevel",
        label: "Operating Voltage Level",
        type: "select",
        required: true,
        options: [
          { label: "415V Low Voltage 3-Phase", value: "415V" },
          { label: "230V Single Phase", value: "230V" },
          { label: "3.3kV Medium Voltage", value: "3.3kV" },
          { label: "6.6kV Medium Voltage", value: "6.6kV" },
          { label: "11kV High Voltage", value: "11kV" },
        ],
        defaultValue: "415V",
      },
      {
        name: "isolationPoints",
        label: "Isolation Points (comma-separated or list)",
        type: "text",
        required: true,
        description: "e.g. Feeder Breaker CB-4, Control Fuse F2, Air Valve V-12",
        defaultValue: "MCC-01 Breaker CB-4",
      },
      {
        name: "lockNumbers",
        label: "Padlock Serial Numbers Applied",
        type: "text",
        required: true,
        description: "e.g. RED-LK-108, MASTER-092",
      },
      {
        name: "tagNumbers",
        label: "Danger Tag Reference Numbers",
        type: "text",
        required: true,
        description: "e.g. DANGER-TAG-551, TAG-552",
      },
      {
        name: "earthingApplied",
        label: "Earth Grounding Leads Attached",
        type: "boolean",
        required: true,
        defaultValue: false,
      },
      {
        name: "testedDeadBy",
        label: "Certified Electrician (Zero Energy Test)",
        type: "text",
        required: true,
        description: "Name & ID of authorized competent person verifying zero voltage.",
      },
    ],
    schema: electricalLotoSchema,
  },
}

export function getPermitTypeConfig(type: PermitType): PermitTypeDefinition {
  const config = PERMIT_TYPE_REGISTRY[type]
  if (!config) {
    throw new Error(`Permit type config not found for: ${type}`)
  }
  return config
}
