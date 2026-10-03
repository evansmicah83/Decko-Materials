# Decko Materials — Field Materials Management System
**Decko Africa Ltd.** | Turnkey Telecommunications & Fibre Infrastructure Management System

Official Website: [https://deckoafrica.com](https://deckoafrica.com)

---

## 1. Project Overview

The **Decko Materials Management System** replaces the former WhatsApp-based material request process with a unified, audit-compliant digital workflow for telecommunications operations (FTTH, FTTB, FTTD, and backbone fibre construction).

### The Digital Chain
```
FIELD TEAM
  → MATERIAL REQUEST
  → DISPATCHER / PROJECT MANAGER REVIEW & APPROVAL
  → ACCOUNTING / PAYMENT CONFIRMATION
  → STORE AUTHORIZATION & GATE PASS
  → SCANNING & ISSUANCE
  → TEAM RECEIPT & FIELD CUSTODY
  → USAGE & CONSUMPTION
  → REUSABLE TOOL RETURN
  → IMMUTABLE AUDIT TRAIL
  → SAFARICOM ACCOUNTABILITY REPORTING
```

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Canvas Confetti, HTML5 QR/Barcode Scanner, jsPDF.
- **Backend**: Node.js 22, Express.js, TypeScript, JWT authentication, bcrypt password hashing.
- **Database**: Supabase PostgreSQL stores authentication, user profiles, teams, projects, inventory, requests, approvals, notifications, and audit history.
- **Mobile Packaging**: Capacitor (`capacitor.config.ts`, Package ID `ke.decko.materials`) for Android APK deployment.
- **Documentation**: OpenAPI / Swagger interactive documentation available at `/api/docs`.

---

## 3. Organizational Structure & Roles

| Role | Responsibilities |
|---|---|
| `SUPER_ADMIN` | Complete administrative access, system settings, SLA policies. |
| `ADMIN` | Universal access, including user and team administration. |
| `HR` | Universal access, including creating staff accounts, team leaders, and crew rosters. |
| `PROJECT_MANAGER` | Universal access, including creating staff accounts, team leaders, and crew rosters. |
| `FIELD_TEAM_LEADER` | Create & submit requests, verify field quantities, view virtual team stock. |
| `FIELD_TECHNICIAN` | Individual, manager-provisioned sign-in scoped to the assigned team's work and material custody. |
| `DISPATCHER` | Review incoming requests, assign sites/teams, technical review. |
| `PROJECT_MANAGER` | Authorize project requests, monitor material expenditure and variance. |
| `ACCOUNTANT` | Accounting Queue processing, confirm disbursement references (M-Pesa / EFT). |
| `STORE_OFFICER` | Verify authorization, scan serial numbers, issue materials, accept tool returns. |
| `PROCUREMENT_OFFICER`| Manage procurement purchase orders and supplier deliveries. |
| `AUDITOR` | Immutable audit log inspection, chain-of-custody verification, Safaricom reports. |
| `VIEWER` | Read-only executive dashboard inspection. |

Employee portal accounts are created by an authenticated Admin, HR Manager, or Project Manager from **Teams & Stock → Create Staff Account**. New accounts must change their temporary password at first sign-in. A Field Technician can sign in with their own manager-provisioned credentials and is restricted to their assigned team; technicians cannot access other teams or warehouse-wide inventory. HR and Project Managers have access to the management features, including team and crew administration.

---

## 4. Projects, Teams, and Live Operational Data

Existing user accounts are preserved when operational demo data is removed. Sign in with an account already provisioned for your organization; do not rely on sample users or a shared development password. Authorized managers can provision staff accounts from **Teams & Stock → Create Staff Account**.

To set up field operations:

1. From **Teams & Stock → Client Projects & Contracts**, create an FTTH or FTTB project with its unique code, name, actual client, region, status, approved budget (if available), and contract start/expiry dates. The project portfolio tracks contract health and expiry, along with assigned teams and staff. Correct missing dates on an existing project before assigning teams or employees.
2. Create a team under an active, in-date project of the same network type. Enter its code/number, name, county or region, assigned area, and optionally assign an existing team leader. New teams cannot be created without an eligible project.
3. Add crew members to the team roster. To enable sign-in, create an individual Field Team Leader or Field Technician account and assign it to that team and its project.
4. For non-field employees, select one or more active client projects in the **Create Staff Account** project assignment step. Admin, HR, and Project Manager accounts can remain organization-wide. New accounts must change their temporary password at first sign-in.
5. In **Inventory**, create a warehouse before posting stock. Inventory adjustments require an explicit warehouse; material creation with opening stock also requires a warehouse ID.
6. Create real operational records through the application's management workflows. No sample projects, teams, materials, warehouse balances, or tracked units are included as operational data.

Teams and staff cannot be assigned to a project unless its status is active/in progress and its contract dates include today. A field employee's project is derived from their team, while non-field employees can be assigned to multiple client projects.

---

## 6. Development & Deployment Commands

```bash
# Install dependencies
npm install

# Copy .env.example to .env and set private values for SUPABASE_DATABASE_URL,
# JWT_SECRET, and JWT_REFRESH_SECRET before starting the server.

# Start full-stack development server (Express backend + Vite frontend)
npm run dev

# Run TypeScript checks
npm run lint

# Production build
npm run build

# Start the full-stack server locally
npm start
```

### Android APK Packaging (Capacitor)
```bash
# Initialize Android project
npx cap add android

# Build web assets and sync to native Android
npm run build
npx cap sync android

# Open Android Studio to compile APK
npx cap open android
```

### Production deployment (Vercel + Supabase)

Vercel serves both the Vite application and the Express API as a serverless function. Supabase PostgreSQL is the only production database; the API does not rely on a Vercel filesystem or SQLite persistence.

1. Apply `supabase/migrations/20261003210000_operational_schema.sql` in the Supabase SQL Editor if the operational schema has not already been applied. The migration uses `IF NOT EXISTS` so it can safely fill the project schema gaps.
2. In the Vercel project's **Settings → Environment Variables**, add the following as **server-side secrets** for Production and Preview:
   - `SUPABASE_DATABASE_URL`: the Supabase PostgreSQL connection string. Use the pooler URL for serverless workloads and keep the password private.
   - `JWT_SECRET` and `JWT_REFRESH_SECRET`: separate random secrets, each at least 32 characters long.
3. `VITE_API_BASE_URL` is optional. The frontend defaults to the same-origin `/api/v1` endpoint; if set, use `/api/v1`. Never put a database URL or JWT secret in a `VITE_*` variable.
4. Push the project to the connected GitHub branch or redeploy from Vercel. Check `/api/health` and `/api/docs` on the deployed domain, then test sign-in with an active organization account.

For local development, configure the same three database/JWT values in `.env`. The app uses the configured Supabase database for local API traffic too. Never commit `.env` or expose server-only credentials in frontend environment variables.

---

## 7. Interactive API Documentation

Access the interactive OpenAPI specification directly in your browser:
```
http://localhost:3000/api/docs
```
Includes endpoints for:
- Authentication & Sessions (`/api/v1/auth/*`)
- Material Requests & Lifecycle State Machine (`/api/v1/material-requests/*`)
- Materials Master & Balances (`/api/v1/materials/*`)
- Inventory Ledger & Transactions (`/api/v1/inventory/*`)
- Teams & Stock Accounts (`/api/v1/teams/*`)
- Projects & Cost Analytics (`/api/v1/projects/*`)
- Safaricom Transparency & Compliance Reports (`/api/v1/reports/*`)
- Immutable Audit Trail (`/api/v1/audit-logs/*`)
