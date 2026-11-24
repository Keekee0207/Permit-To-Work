# Opmaint PTW — Industrial Permit to Work Module

A production-grade, shop-floor ready **Permit to Work (PTW)** module engineered for Indian industrial plants (compliant with Indian Standard **IS 14489** and OSHA 1910 work safety frameworks). Built with **Next.js 14 (App Router) + TypeScript**, **PostgreSQL + Prisma ORM**, and **Tailwind CSS**.

---

## 1. Quick Setup & Clean-Machine Run Guide

### Prerequisites
- **Node.js**: v18+ (tested on v22.14.0)
- **PostgreSQL**: v14+ running locally or remotely
- **Git**

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Keekee0207/Permit-To-Work.git
   cd Permit-To-Work
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root folder (or copy from `.env.example`):
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/opmaint_ptw?schema=public"
   JWT_SECRET="super-secret-jwt-key-for-opmaint-ptw-system-2024"
   CRON_SECRET="ptw-cron-secret-key"
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Run Database Migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Populate Database with Realistic Indian Industrial Seed Data:**
   ```bash
   npm run seed
   # or: npx tsx prisma/seed.ts
   ```

6. **Run Automated Test Suite:**
   ```bash
   npm test
   ```

7. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Demo User Credentials (One for Each Role)

The database seed creates 4 realistic demo users covering all 4 system roles. All accounts use password: `Password@123`.

| Role | Name | Email | Password | Scope & Responsibilities |
|---|---|---|---|---|
| **`REQUESTER`** | Rajesh Kumar | `requester@chennai.opmaint.com` | `Password@123` | Creates permits, saves drafts, submits permits, logs confined space entry, marks work complete (`ACTIVE` -> `CLOSED`). Cannot approve permits. |
| **`AREA_OWNER`** | M. Senthil | `areaowner@chennai.opmaint.com` | `Password@123` | Assigned to Boiler Area (`BLR-AREA`) & Reaction Bay (`RCT-BAY`). Approves/rejects permits strictly within assigned areas. |
| **`SAFETY_OFFICER`** | K. Radhakrishnan | `safety@chennai.opmaint.com` | `Password@123` | Site-wide authority. Reviews safety checks, captures digital canvas signatures, suspends active permits during emergencies, approves extension requests, and verifies site safety for closure verification (`CLOSED` -> `CLOSED_VERIFIED`). |
| **`ADMIN`** | Pooja Nair | `admin@chennai.opmaint.com` | `Password@123` | Full access. Manages plants, operational areas, equipment tag codes, and creates user accounts via `/admin`. |

> **Pro Tip:** In the top navigation bar, there is a **Demo Quick Switcher** pill that lets you switch between all 4 personas with a single click.

---

## 3. Industrial Data Hierarchy & Seeded Work Permits

### Plants & Areas
1. **Chennai Heavy Engineering Plant 1 (`CHE-01`)** — Ambattur Industrial Estate, Chennai, TN
   - `BLR-AREA`: Boiler & Steam Utility Area
   - `RCT-BAY`: Solvent Reaction Vessel Bay
2. **Sriperumbudur Auto-Component Plant 2 (`SRP-02`)** — SIPCOT Industrial Park, Sriperumbudur, TN
   - `HV-MCC`: High Voltage Substation & MCC Room
   - `STP-BAY`: Stamping Press & Overhead Crane Bay

### Seeded Permits Across All Lifecycle States
- **`PTW-2024-0001` (DRAFT)**: Working at Height on overhead crane rails (8.5m).
- **`PTW-2024-0002` (PENDING_APPROVAL)**: Hot Work flange welding in Boiler Area.
- **`PTW-2024-0003` (APPROVED)**: Electrical LOTO on 415V MCC panel.
- **`PTW-2024-0004` (ACTIVE - Expiring Soon)**: Hot work grinding with **< 2 hours validity left**, showing the live countdown clock and amber alert badge.
- **`PTW-2024-0005` (ACTIVE - Confined Space)**: Internal chemical descaling inside Polymerizer Reactor R-201 with live technician entry/exit personnel logs.
- **`PTW-2024-0006` (SUSPENDED)**: Suspended due to 48 km/h high wind gusts.
- **`PTW-2024-0007` (EXPIRED)**: Auto-expired permit after shift conclusion.
- **`PTW-2024-0008` (CLOSED)**: Relay calibration completed, awaiting Safety Officer closeout verification.
- **`PTW-2024-0009` (CLOSED_VERIFIED)**: Burner nozzle replacement verified clean, de-isolated, and safe.
- **`PTW-2024-0010` (REJECTED)**: Confined space entry rejected due to deficient Oxygen (18.2%) and high LEL (15%).

---

## 4. Key Architectural Decisions (Where the Spec Was Silent)

1. **Extensible Single-Table Shared Permit Architecture (`permitTypeConfig.ts`)**:
   Instead of fragmenting the database with 4 distinct tables or duplicate form code, we engineered a central TypeScript + Zod registry. The core `Permit` table stores universal attributes (`plannedStart`, `plannedEnd`, `contractorTeam`, `hazards`, `ppeRequired`, `precautionsChecklist`), while specialized parameters (`o2Percent`, `voltageLevel`, `isolationPoints`, `hotWorkType`) reside in a typed `typeSpecificData` JSONB column. Adding a 5th permit type (e.g. `EXCAVATION` or `RADIATION`) requires only adding an entry in `lib/permitTypeConfig.ts` without database schema changes.
2. **Deterministic Server-Side State Machine (`permitStateMachine.ts`)**:
   UI action buttons are strictly rendered based on the user's role and current permit state. Even if an attacker uses `curl` or Postman to invoke an action endpoint, every transition is verified server-side against:
   - Self-approval ban
   - Area Owner area scope check
   - Mandatory rejection reasons
   - Auto-expiry validation
   - All required approvers condition before `ACTIVE`
   - Start time constraint (`now >= plannedStart`)
3. **Dual Lazy Expiry + Cron Expiry**:
   To ensure permits expire even when no user has a dashboard open, expiry checks run on every permit read/write API call, and an external endpoint `/api/cron/expire` is exposed for serverless or system cron jobs.
4. **Safety Conflict Engine (`/api/permits/check-conflicts`)**:
   Hot Work and Confined Space permits operating in the same area during overlapping time intervals present catastrophic fire/atmospheric risks. The form triggers automated conflict checks in real time, alerting engineers with an unmissable red warning banner before submission.
5. **Human-Readable Audit Trail**:
   Rather than dumping raw JSON diffs, the audit trail renders an event timeline showing the exact actor, action name, before/after states, timestamp in Indian Standard Time (IST), and comments.

---

## 5. What AI Was Used For

- Drafting initial boilerplate schema configurations and TypeScript interfaces for the 4 industrial permit types.
- Generating realistic Indian manufacturing domain data (SIPCOT/Ambattur plants, IS 14489 safety precautions, multi-gas thresholds, LOTO procedures).
- Rapidly scaffolding test cases in Vitest covering edge cases (such as self-approval attempts by admins and area owner boundary breaches).

---

## 6. What We'd Build Next & What Was Left Out

### What We Would Build Next:
1. **Offline-First PWA with Background Sync**: Technicians inside steel vessels or basements often lose 4G connectivity; local IndexedDB caching with service worker sync would provide seamless offline capability.
2. **Hardware Gas Detector Bluetooth Integration**: Direct BLE telemetry streaming from 4-gas meters (e.g., Honeywell or RAE Systems) straight into the Confined Space log to prevent manual transcription errors.
3. **Automated WhatsApp / SMS Alerts**: Integration with Gupshup or Twilio for WhatsApp notifications to Plant Managers when high-hazard permits are raised or auto-expire.

### What Was Knowingly Left Out (Per Explicit Out-of-Scope Requirements):
- Real-time WebSockets / live multi-user cursor sync.
- Production S3 / Cloudinary photo upload (a URL string field is provided).
- Email/SMS dispatch (mocked through `notifyStub()`).
- Multi-tenancy, billing, or subscription onboarding.
