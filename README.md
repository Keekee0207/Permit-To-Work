# Opmaint PTW — Industrial Permit to Work Module

A production-grade, shop-floor ready **Permit to Work (PTW)** module engineered for Indian industrial plants (compliant with Indian Standard **IS 14489:1998** and OSHA 1910 work safety frameworks). Built with **Next.js 14 (App Router) + TypeScript**, **PostgreSQL + Prisma ORM**, and **Tailwind CSS**.

- **Repository**: [https://github.com/Keekee0207/Permit-To-Work](https://github.com/Keekee0207/Permit-To-Work)
- **Live Vercel Deployment**: [https://permit-to-work-keekee.vercel.app](https://permit-to-work-keekee.vercel.app) *(or your deployed Vercel URL)*

---

## Table of Contents
1. [Quick Setup & Clean-Machine Run Guide](#1-quick-setup--clean-machine-run-guide)
2. [Demo User Credentials (One for Each Role)](#2-demo-user-credentials-one-for-each-role)
3. [Industrial Data Hierarchy & Seeded Work Permits](#3-industrial-data-hierarchy--seeded-work-permits)
4. [Key Architectural Decisions (Where the Spec Was Silent)](#4-key-architectural-decisions-where-the-spec-was-silent)
5. [Automated Test Suite (Vitest)](#5-automated-test-suite-vitest)
6. [What AI Was Used For](#6-what-ai-was-used-for)
7. [What We'd Build Next](#7-what-wed-build-next)
8. [What Was Knowingly Left Incomplete / Broken (Per Explicit Spec Scope)](#8-what-was-knowingly-left-incomplete--broken-per-explicit-spec-scope)

---

## 1. Quick Setup & Clean-Machine Run Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v20 & v22)
- **PostgreSQL**: v14+ (or Neon Serverless PostgreSQL)
- **Git**

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Keekee0207/Permit-To-Work.git
   cd Permit-To-Work
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or use your own PostgreSQL connection string):
   ```env
   # Neon Serverless PostgreSQL or local PostgreSQL:
   DATABASE_URL="postgresql://neondb_owner:npg_S4pJwsGHk9qv@ep-gentle-art-bd85a1z4-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"
   
   # JWT Secret used to sign 24h HTTP-only session cookies:
   JWT_SECRET="super-secret-jwt-key-for-opmaint-ptw-system-2024"
   
   # Shared secret token for the automated expiry cron job:
   CRON_SECRET="ptw-cron-secret-key"
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Initialize Database Schema & Generate Prisma Client:**
   ```bash
   npx prisma generate
   npx prisma db push
   # or: npx prisma migrate dev --name init
   ```

5. **Populate Database with Realistic Indian Industrial Seed Data:**
   ```bash
   npm run seed
   # or: npx tsx prisma/seed.ts
   ```
   *This automatically creates 4 demo users, 2 manufacturing plants, 4 operational zones, 6 industrial equipment items, and 10 realistic permits spanning every state in the lifecycle.*

6. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
   *Runs 14 Vitest test assertions verifying state-machine transitions, role authorizations, self-approval blocking, and Area Owner zoning.*

7. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

8. **Production Build & Verification:**
   ```bash
   npm run build
   npm run start
   ```

---

## 2. Demo User Credentials (One for Each Role)

The database seed provisions 4 realistic demo users covering all 4 system roles. All accounts share the same default password: `Password@123`.

| Role | Person & Email | Default Password | Assigned Plant Scope | Allowed Actions & Boundaries |
|---|---|---|---|---|
| **`REQUESTER`** | **Rajesh Kumar**<br>`requester@chennai.opmaint.com` | `Password@123` | Plant-wide requester | Can create permits, save private drafts, submit permits for approval, log technician confined space entry/exit logs, request time extensions, and mark work complete (`ACTIVE` &rarr; `CLOSED`). **Cannot approve or sign permits.** |
| **`AREA_OWNER`** | **M. Senthil**<br>`areaowner@chennai.opmaint.com` | `Password@123` | Assigned to **Boiler Area (`BLR-AREA`)** & **Reaction Bay (`RCT-BAY`)** | Plant floor supervisor who reviews and approves permits **strictly within assigned areas**. Cannot approve permits outside assigned zones. Cannot approve permits they personally created (self-approval ban). |
| **`SAFETY_OFFICER`** | **K. Radhakrishnan**<br>`safety@chennai.opmaint.com` | `Password@123` | Site-wide HSE authority | Performs technical safety inspections, signs off with digital canvas signatures, suspends active permits during emergencies, approves extension requests, and conducts physical site verification for final closeout (`CLOSED` &rarr; `CLOSED_VERIFIED`). |
| **`ADMIN`** | **Pooja Nair**<br>`admin@chennai.opmaint.com` | `Password@123` | Full administrative access | Has full system visibility. Manages master data: plants, operational areas, equipment tag codes, and user personnel records via `/admin`. |

> **⚡ Pro Tip:** On both the Login page and the top Navigation Bar, there is a **1-Click Demo Quick Switcher**. You can instantly toggle between all 4 personas without manually typing passwords.

---

## 3. Industrial Data Hierarchy & Seeded Work Permits

### Plants & Operational Areas
1. **Chennai Heavy Engineering Plant 1 (`CHE-01`)** — *Ambattur Industrial Estate, Chennai, Tamil Nadu*
   - `BLR-AREA`: Boiler & Steam Utility Area (Equipment: `CHE-BLR-01` High-Pressure Boiler #1)
   - `RCT-BAY`: Solvent Reaction Vessel Bay (Equipment: `CHE-RCT-201` Polymerizer Reactor R-201)
2. **Sriperumbudur Auto-Component Plant 2 (`SRP-02`)** — *SIPCOT Industrial Park, Sriperumbudur, Tamil Nadu*
   - `HV-MCC`: High Voltage Substation & MCC Room (Equipment: `SRP-MCC-01` 415V Main MCC Panel)
   - `STP-BAY`: Stamping Press & Overhead Crane Bay (Equipment: `SRP-CRN-02` 20T Overhead EOT Crane)

### Seeded Permits Across All 10 Lifecycle States
Evaluators can log in and immediately inspect realistic industrial records without manual setup:
- **`PTW-2024-0001` (`DRAFT`)**: Working at Height on overhead crane rails (8.5m). Private to the requester.
- **`PTW-2024-0002` (`PENDING_APPROVAL`)**: Hot Work flange welding in Boiler Area awaiting dual sign-off.
- **`PTW-2024-0003` (`APPROVED`)**: Electrical LOTO on 415V MCC panel with dual signatures, ready for activation.
- **`PTW-2024-0004` (`ACTIVE` — Expiring Soon)**: Hot work grinding with **< 2 hours validity left**, displaying the live amber alert banner and countdown clock.
- **`PTW-2024-0005` (`ACTIVE` — Confined Space)**: Internal chemical descaling inside Reactor R-201 with live technician entry/exit headcount logs.
- **`PTW-2024-0006` (`SUSPENDED`)**: Emergency suspension triggered by Safety Officer due to 48 km/h high wind gusts.
- **`PTW-2024-0007` (`EXPIRED`)**: Auto-expired permit after work window lapsed without an extension.
- **`PTW-2024-0008` (`CLOSED`)**: Relay calibration finished by contractor; waiting for Safety Officer site verification.
- **`PTW-2024-0009` (`CLOSED_VERIFIED`)**: Burner nozzle replacement verified clean, de-isolated, and safe.
- **`PTW-2024-0010` (`REJECTED`)**: Confined space entry rejected due to deficient Oxygen (18.2%) and high LEL (15%).

---

## 4. Key Architectural Decisions (Where the Spec Was Silent)

### 1. Extensible Single-Table Shared Permit Architecture (`permitTypeConfig.ts`)
Instead of fragmenting the database into 4 separate tables or copy-pasting 4 different form components, we engineered a single extensible schema:
- Universal permit fields (`plannedStart`, `plannedEnd`, `contractorTeam`, `hazards`, `ppeRequired`, `precautionsChecklist`) live on the core `Permit` table.
- Type-specific parameters (`o2Percent`, `voltageLevel`, `isolationPoints`, `hotWorkType`, `heightMeters`) reside in a typed `typeSpecificData` JSONB column.
- A central TypeScript + Zod registry (`lib/permitTypeConfig.ts`) drives form field generation, hazard checklists, and validation. Adding a 5th permit type (e.g., `EXCAVATION` or `RADIATION`) requires **only a single configuration object** without altering database tables or UI code.

### 2. Strict Private Drafts Rule
In industrial operations, incomplete drafts can cause confusion if visible to supervisors. Drafts are **strictly private** to the technician who created them (`requesterId === currentUser.id`). Neither Area Owners nor Safety Officers can see or act on a draft until the requester formally clicks **"Submit for Approval"**.

### 3. Server-Side State Machine & Uncompromising RBAC (`permitStateMachine.ts`)
Frontend UI buttons are rendered dynamically based on role and state, but **the frontend is never trusted for security**. Every transition is validated on the backend:
- **Self-Approval Ban**: Requesters cannot approve their own permits, even if they have an `ADMIN` or `AREA_OWNER` role.
- **Area Scoping**: Area Owners can only approve permits where `permit.areaId` matches their assigned `userArea` records.
- **Mandatory Rejection Reasons**: Rejections require an audited explanatory comment.
- **All-Approvers Condition**: Both the Area Owner and Safety Officer must approve before a permit can transition to `APPROVED` or `ACTIVE`.
- **Timing Guard**: A permit cannot become `ACTIVE` before `plannedStart`.

### 4. SIMOPS Conflict Detection Engine (`/api/permits/check-conflicts`)
Simultaneous Operations (SIMOPS) pose high danger (e.g., Hot Work sparks near an active Confined Space entry). Whenever a requester selects an area, type, and timeframe, the API evaluates overlapping permits in real time and displays an unmissable red conflict alert banner with permit details.

### 5. Physical QR Code Inspection Mode (`?scan=true`)
Every permit displays a dynamic QR code. On a physical shop floor, safety auditors or technicians scan the printed or displayed badge with any phone camera. The link opens `/permits/[id]?scan=true` in a **dedicated read-only field inspection mode**, hiding all action buttons and presenting verified safety credentials without requiring an auditor login.

### 6. Throttled Lazy Expiry + Cron Expiry (`lib/expiryService.ts`)
To enforce strict compliance without overwhelming serverless databases:
- API reads and writes trigger lazy expiration checks, throttled in-memory to run at most once every 30 seconds.
- An external cron route (`/api/cron/expire`) authenticated via `CRON_SECRET` supports scheduled triggers from Vercel Cron or GitHub Actions.

### 7. Performance Optimizations for Vercel Serverless
- **Persistent Prisma Singleton**: Preserves `globalThis.prisma` across warm lambdas to avoid connection churn on Neon PostgreSQL.
- **In-Token Area Scope**: Embeds `assignedAreaIds` directly into the signed JWT token, eliminating redundant database queries on authenticated requests.
- **Edge Cache Headers**: `/api/plants` serves static facility hierarchies from Vercel Edge CDN in **< 20ms** (`s-maxage=300`).
- **Client Cache**: Preloads plant hierarchy in browser memory for instant transitions between Dashboard and "+ Raise New Permit".

---

## 5. Automated Test Suite (Vitest)

Run all unit and integration tests with:
```bash
npm test
```

### Verified Test Cases (`test/stateMachine.test.ts`):
1. Transitions `DRAFT` &rarr; `PENDING_APPROVAL` with dual approval slots.
2. Transitions to `APPROVED` only when **both** Area Owner and Safety Officer sign off.
3. Automatically transitions to `REJECTED` if either approver rejects.
4. Transitions `APPROVED` &rarr; `ACTIVE` upon physical field handover.
5. Rejects illegal transitions (e.g., activating a draft directly).
6. **Enforces Self-Approval Ban**: Rejects approval if requester attempts to approve their own permit.
7. **Enforces Area Owner Scope**: Blocks an Area Owner from approving a permit in an unassigned zone.
8. Enforces Safety Officer site-wide authority for emergency suspensions.
9. Validates extension requests within allowed limits (max 4h, max 2 extensions).
10. Validates closure workflow (`ACTIVE` &rarr; `CLOSED` &rarr; `CLOSED_VERIFIED`).
11. Enforces mandatory comments on rejection and suspension.
12. Detects SIMOPS conflicts between overlapping Hot Work and Confined Space jobs.
13. Automatically expires active permits whose validity deadline has lapsed.
14. Prevents actions on expired or cancelled permits.

---

## 6. What AI Was Used For

In accordance with transparent engineering practices, AI assistance was utilized for:
1. **Safety Standards & Domain Research**: Summarizing Indian Standard **IS 14489:1998** (Code of Practice on Occupational Safety & Health Audit) and OSHA 1910 regulatory parameters (multi-gas limits: O2 19.5%–23.5%, LEL < 10%, H2S < 10 ppm, CO < 35 ppm).
2. **Realistic Industrial Domain Data**: Generating realistic plant names, equipment tag codes, chemical reaction scenarios, and contractor teams based in Chennai and Sriperumbudur industrial zones.
3. **Scaffolding Test Assertions**: Rapidly generating test matrices for edge cases (e.g., boundary condition checks for self-approval and cross-area authorization).
4. **Drafting Initial Schema & Type Definitions**: Accelerating boilerplate creation for the 4 dynamic JSONB schemas in `permitTypeConfig.ts`.

---

## 7. What We'd Build Next

If taking this application into full commercial plant production, the immediate next priorities would be:

1. **WebSockets for Real-Time Safety Broadcasts**:
   - Replace 15-second polling with WebSockets (e.g., Pusher or Socket.io). When a Safety Officer triggers an **Emergency Stop**, all technician screens on the shop floor turn red with audible alarms in **< 50 milliseconds**.
2. **Offline-First Progressive Web App (PWA) with Background Sync**:
   - Industrial technicians often enter basements, transformer yards, or internal vessel shells where 4G/Wi-Fi signal drops to zero. Local IndexedDB storage with Service Worker background synchronization would allow workers to log gas readings and entry/exit logs offline.
3. **Hardware Bluetooth LE (BLE) Gas Detector Pairing**:
   - Connect directly with handheld 4-gas atmospheric monitors (e.g., Honeywell BW, Dräger, RAE Systems) over Web Bluetooth to stream live O2/LEL readings into Confined Space permits without manual entry errors.
4. **WhatsApp & SMS Urgent Dispatch**:
   - Integrate with Gupshup or Twilio to dispatch immediate WhatsApp interactive messages to Area Owners when permits require sign-off, or when a permit has < 1 hour remaining.

---

## 8. What Was Knowingly Left Incomplete / Broken (Per Explicit Spec Scope)

Per the assignment's explicit instructions (*"Explicitly Out of Scope — DO NOT BUILD"*):

1. **WebSockets & Real-Time Sync**:
   - Omitted per spec. Implemented a 15-second client ticker and server-side throttled lazy expiry instead.
2. **Binary File & Photo Upload Storage**:
   - Omitted AWS S3 or Cloudinary integration. The form supports direct photo URLs via a text input.
3. **Live SMS/Email Notification Dispatch**:
   - Real email/SMS gateway delivery is not wired; all dispatches are handled via an audited `notifyStub()` logger function.
4. **Multi-Tenancy, Billing & Organization Onboarding**:
   - Focus is exclusively on a single plant enterprise operations workflow; multi-tenant subscription tiers were not implemented.
5. **Direct Mutation on Field QR Code Scan**:
   - Scanning a permit QR code deliberately opens in read-only mode (`?scan=true`) to prevent unauthorized field edits by passersby.

---

## License & Compliance
Engineered for industrial safety compliance under Indian Standard **IS 14489** and OSHA 1910 standards.
Created by **Keerthana S** as part of the Opmaint PTW engineering assignment.
