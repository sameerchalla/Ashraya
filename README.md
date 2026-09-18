# Ashraya · Smart Study Lounge & Library Management System

> **High-throughput multi-shift seat allocation, digital gate turnstile validation, and dynamic member pass system for self-study reading rooms and 24/7 academic libraries.**

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
  - [Monorepo Structure](#monorepo-structure)
  - [Applications (`apps/`)](#applications-apps)
  - [Shared Packages (`packages/`)](#shared-packages-packages)
- [Key Features & Engineering Highlights](#key-features--engineering-highlights)
- [Database Schema & Supabase Migrations](#database-schema--supabase-migrations)
  - [Prerequisites](#prerequisites)
  - [Applying Migrations](#applying-migrations)
  - [Database Seeding](#database-seeding)
  - [Atomic Booking Function (`book_seat`)](#atomic-booking-function-book_seat)
- [Local Development Setup](#local-development-setup)
  - [Environment Variables](#environment-variables)
  - [Installation & Startup](#installation--startup)
  - [Scripts & Quality Assurance](#scripts--quality-assurance)
- [Deployment Guidelines](#deployment-guidelines)
  - [Deploying to Vercel](#deploying-to-vercel)
  - [Deploying to Google Cloud Run](#deploying-to-google-cloud-run)
- [Hardware & Turnstile Integration](#hardware--turnstile-integration)
- [Author](#author)

---

## Overview

**Ashraya** is an enterprise-grade library and study lounge operations platform built specifically for competitive exam reading rooms, academic libraries, and shared study lounges. In high-density study centers where hundreds of students share a limited number of dedicated desks across rotating shifts (Morning, Afternoon, Evening, Night), legacy spreadsheet or paper-based workflows inevitably cause double-booking conflicts, expired pass disputes, and gate bottlenecks.

Ashraya provides a unified, real-time operating solution:
- **Interactive Floor Console**: High-density 240-seat visual floor plan with quadrant multi-shift occupancy indicators and real-time Supabase synchronization.
- **Atomic Allotment Engine**: PostgreSQL transactional booking engine that mathematically guarantees zero double-booking conflicts across shift time intervals.
- **Dynamic Digital Student Pass**: PWA-ready student pass with an auto-refreshing 60-second rotating cryptographic QR token to prevent screenshot sharing.
- **Gate Turnstile Kiosk**: Physical entrance kiosk operating with sub-50ms verdict latency, Web Audio API auditory chimes, 1.5-second turnstile relay pulse triggering, and offline cache resiliency.

---

## System Architecture

Ashraya is structured as a scalable monorepo using npm/bun workspaces to cleanly decouple client interfaces, shared business logic, and API contracts.

```
ashraya-monorepo/
├── apps/
│   ├── api/          # Express.js REST API & background worker service
│   ├── console/      # Administrative interactive floor plan & seat allotment app
│   ├── gate/         # Turnstile gate kiosk & hardware verification app
│   └── member/       # Student digital identity & rolling QR pass PWA
├── packages/
│   ├── contracts/    # Shared TypeScript DTOs, domain models, and Zod schemas
│   └── utils/        # Common utilities (date math, QR token generators, formatting)
├── supabase/
│   ├── migrations/   # PostgreSQL schema, GiST exclusion constraints, and RLS
│   │   └── 0001_init.sql
│   └── seed.sql      # Seed fixtures for branches, seats, shifts, and members
├── src/              # Root unified presentation dashboard (React 19 + Vite)
├── public/           # Static assets, web app manifest, and icons
├── package.json      # Workspace root package manifest
├── tsconfig.base.json# Base TypeScript configuration
└── vite.config.ts    # Vite bundler configuration with Tailwind CSS v4
```

### Applications (`apps/`)

- **`apps/console`**:
  Administrative control surface for library managers. Renders a 240-seat interactive floor grid across Zones A through D. Features single-shift focus and 4-quadrant multi-shift view modes, instant seat search, active conflict detection, and a sliding drawer for seat allotments.
- **`apps/gate`**:
  Turnstile gate terminal designed to run continuously on entrance kiosks or mounted tablets. Listens for optical barcode/QR scanners or manual roll number queries. Evaluates validity against shift rules in under 50ms and emits visual and auditory alerts.
- **`apps/member`**:
  Student-facing Progressive Web App (PWA). Displays the student's photo identification, assigned desk code, current shift slot, and a rotating dynamic QR code with a 60-second countdown ring and high-contrast brightness boost.
- **`apps/api`**:
  Node.js service powered by Express, helmet, cors, and pino. Proxies administrative commands, orchestrates background batch jobs (e.g., lapsed seat auto-release), and interacts directly with PostgreSQL.

### Shared Packages (`packages/`)

- **`packages/contracts`**:
  Single source of truth for TypeScript interfaces and validation schemas (`dto.ts`). Defines `Seat`, `Shift`, `Member`, `BookingRequest`, `GateVerdict`, and error envelopes.
- **`packages/utils`**:
  Shared pure utility functions including shift timing overlap calculations, cryptographic rolling token helpers, date formatting with institutional timezones, and color status mapping.

---

## Key Features & Engineering Highlights

| Feature | Description |
| :--- | :--- |
| **Interactive 240-Desk Map** | Visual grid rendered with Tailwind CSS v4, supporting 24-desk rows, zone boundaries, and instant zoom. |
| **4-Quadrant Shift Tracking** | Every seat tile visually reflects Morning, Afternoon, Evening, and Night occupancy simultaneously in quadrant mode. |
| **Zero Double-Booking Guarantee** | PostgreSQL exclusion constraints and atomic RPC booking prevent race conditions across parallel admin terminals. |
| **Dynamic Rolling QR Code** | Regenerates token every 60 seconds using time-based salting; invalidates static screenshots used for illicit entry. |
| **Sub-50ms Turnstile Latency** | Optimized evaluation pipeline for near-instantaneous student throughput during morning peak rush hours. |
| **Offline Cache Resiliency** | Kiosk caches active authorizations locally; gracefully validates entries even if the campus internet drops. |
| **Hardware Relay Integration** | Triggers visual status pulses and 1.5-second relay signals to drive physical turnstiles and magnetic door locks. |
| **Accessibility & Contrast** | High-contrast academic color palette, dark mode support, and full keyboard shortcut navigation (`Ctrl+Enter` / `Esc`). |

---

## Database Schema & Supabase Migrations

The database is built on PostgreSQL 16 utilizing the `btree_gist`, `uuid-ossp`, and `pgcrypto` extensions.

### Core Tables
- **`organizations` & `branches`**: Multi-tenant facility hierarchy with operational rules (grace periods, lockout thresholds).
- **`floors` & `zones`**: Spatial definitions for study halls (Zone A through D).
- **`seats`**: Inventory of physical desks with coordinates and status flags.
- **`shifts`**: Operational time blocks (e.g., Morning 06:00–12:00, Afternoon 12:00–18:00, Evening 18:00–00:00, Night 00:00–06:00).
- **`members`**: Student profiles, roll numbers, validity expiration dates, and portrait photos.
- **`bookings`**: Historical and active seat allotments guarded by date range and shift constraints.
- **`gate_logs`**: Tamper-proof audit logs recording every turnstile scan, verdict, latency, and guard override.

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed locally, OR an active project on [supabase.com](https://supabase.com).

### Applying Migrations

#### Option A: Using the Supabase CLI (Local or Remote)

1. Link your local project to your remote Supabase instance:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

2. Push all pending migrations located in `supabase/migrations/`:
   ```bash
   npx supabase db push
   ```

#### Option B: Using the Supabase Web SQL Editor

1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** tab.
3. Open `supabase/migrations/0001_init.sql` from this repository, paste its contents into the editor, and click **Run**.

### Database Seeding

To populate initial mock branches, shifts, 240 seats, and sample student profiles:

```bash
# Using Supabase CLI
npx supabase db reset # applies migrations and executes supabase/seed.sql automatically
```
Or paste the contents of `supabase/seed.sql` into the Supabase SQL Editor and execute it.

### Atomic Booking Function (`book_seat`)

Seat allotment uses a stored PostgreSQL function to prevent race conditions:

```sql
select public.book_seat(
  p_member_id := 'mem-uuid',
  p_seat_id   := 'seat-uuid',
  p_shift_id  := 'shift-uuid',
  p_start_date := current_date,
  p_end_date   := current_date + interval '30 days',
  p_allotted_by:= auth.uid()
);
```
The function checks for existing active bookings on the targeted seat and shift. If occupied, it raises an exception before any write occurs, guaranteeing transactional integrity.

---

## Local Development Setup

### Environment Variables

Create a `.env.local` file in the root directory (refer to `.env.example`):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Server Secrets (for apps/api)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
```

### Installation & Startup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-org>/ashraya.git
   cd ashraya
   ```

2. **Install all workspace dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000`.

### Scripts & Quality Assurance

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server on port 3000 |
| `npm run build` | Builds the production bundle into the `/dist` directory |
| `npm run lint` | Runs strict TypeScript compiler checks (`tsc --noEmit`) |
| `npm run preview` | Locally serves the production build in `/dist` |
| `npm run clean` | Cleans build artifacts and compiled distributions |

---

## Deployment Guidelines

### Deploying to Vercel

Vercel provides zero-configuration static and SPA hosting with automated CI/CD.

1. **Push your code** to GitHub, GitLab, or Bitbucket.
2. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
3. **Import** your repository.
4. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. **Environment Variables**:
   Add the required client variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
6. **Deploy**: Click **Deploy**. Vercel will build the workspace and output a global CDN URL with automatic SSL.

#### SPA Client Routing on Vercel
If accessing deep links directly, add a `vercel.json` file in the project root to route all requests to `index.html`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### Deploying to Google Cloud Run

Ashraya is pre-configured for containerized deployment:

1. **Build Container**:
   ```bash
   gcloud builds submit --tag gcr.io/<PROJECT-ID>/ashraya
   ```
2. **Deploy Service**:
   ```bash
   gcloud run deploy ashraya \
     --image gcr.io/<PROJECT-ID>/ashraya \
     --platform managed \
     --region asia-east1 \
     --allow-unauthenticated \
     --port 3000
   ```

---

## Hardware & Turnstile Integration

For physical reading room deployments:

1. **Gate Kiosk Terminal**:
   - Mount an Android tablet, iPad, or Touchscreen All-in-One PC running Google Chrome in fullscreen Kiosk mode (`--kiosk https://your-domain/`).
2. **Optical Barcode & QR Scanner**:
   - Connect any standard USB or Bluetooth 2D barcode imager configured in **HID Keyboard Wedge** mode.
   - When a student scans their phone, the scanner inputs the payload and automatically presses Enter.
3. **Turnstile Relay Activation**:
   - Connect the kiosk workstation to an Ethernet/USB dry-contact relay board (such as Numato or WebRelay).
   - On valid verdict, the kiosk triggers a 1,500ms pulse to release the turnstile solenoid.

---

## Author

Built with ❤️ by [Sameer Challa](https://www.linkedin.com/in/sameer-challa/)
