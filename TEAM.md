# Renzo OS — Team Assignment Guide

## Interns & Roles

| Intern | Role | Git Branch | Modules |
|---|---|---|---|
| **Aman** | Backend | `dev/aman` | Branches, Workers, Worker HR |
| **Gauransh** | Backend | `dev/gauransh` | Services, Appointments, Slots, Booking Flows |
| **Shalmon** | Backend | `dev/shalmon` | Auth, Billing, Inventory, Memberships, Loyalty, Marketing, Reviews |
| **Devanshi** | Frontend | `dev/devanshi` | Public Website, Customer Portal |
| **Hemant** | Frontend | `dev/hemant` | Worker Panel, Reception Panel, Branch Admin, Super Admin |

---

## Git Setup (each intern runs this once)

```bash
git init
git remote add origin <repo-url>
git checkout -b dev/<your-name>
```

Merges happen into `main` only after code review. Never push directly to `main`.

---

## File Ownership — DO NOT touch files outside your area

### Aman — `dev/aman`
**Your files only:**
```
app/api/v1/admin/branches/**
app/api/v1/admin/workers/**
app/api/v1/admin/departments/**
app/api/v1/admin/designations/**
app/api/v1/worker/attendance/**
app/api/v1/worker/leaves/**
app/api/v1/worker/shifts/**
app/api/v1/worker/portfolio/**
app/api/v1/public/branches/**
app/api/v1/public/workers/**
```
**Your APIs to implement:**

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/branches` | List all branches (paginated) |
| POST | `/api/v1/admin/branches` | Create branch |
| GET/PATCH/DELETE | `/api/v1/admin/branches/[id]` | Single branch CRUD |
| GET/PUT | `/api/v1/admin/branches/[id]/timings` | Branch day timings |
| GET/POST | `/api/v1/admin/branches/[id]/holidays` | Branch holidays |
| GET/PATCH | `/api/v1/admin/branches/[id]/settings` | Branch settings |
| GET | `/api/v1/admin/workers` | List workers (paginated, filterable by branch) |
| POST | `/api/v1/admin/workers` | Create worker |
| GET/PATCH/DELETE | `/api/v1/admin/workers/[id]` | Worker CRUD |
| GET/PUT | `/api/v1/admin/workers/[id]/skills` | Worker skills |
| GET/PUT | `/api/v1/admin/workers/[id]/services` | Worker service mapping |
| GET/POST | `/api/v1/admin/workers/[id]/portfolio` | Portfolio approval |
| GET/POST | `/api/v1/admin/workers/[id]/availability` | Worker blocked times |
| GET/POST | `/api/v1/admin/departments` | Departments CRUD |
| GET/POST | `/api/v1/admin/designations` | Designations CRUD |
| GET/POST | `/api/v1/worker/attendance` | Own attendance |
| GET/POST | `/api/v1/worker/leaves` | Own leaves |
| GET/DELETE | `/api/v1/worker/leaves/[id]` | Single leave |
| GET | `/api/v1/worker/shifts` | Own shift |
| GET/POST | `/api/v1/worker/portfolio` | Own portfolio upload |
| GET | `/api/v1/public/branches` | Public branch list |
| GET | `/api/v1/public/branches/[slug]` | Public branch detail |
| GET | `/api/v1/public/workers` | Public worker profiles |
| GET | `/api/v1/public/workers/[id]` | Public worker profile |

---

### Gauransh — `dev/gauransh`
**Your files only:**
```
app/api/v1/admin/services/**
app/api/v1/admin/packages/**
app/api/v1/admin/add-ons/**
app/api/v1/admin/appointments/**
app/api/v1/public/services/**
app/api/v1/public/packages/**
app/api/v1/public/slots/**
app/api/v1/customer/appointments/**
app/api/v1/reception/appointments/**
app/api/v1/worker/appointments/**
```

**Your APIs to implement:**

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/v1/admin/services/categories` | Category CRUD |
| GET/PATCH/DELETE | `/api/v1/admin/services/categories/[id]` | Single category |
| GET/POST | `/api/v1/admin/services` | Service CRUD |
| GET/PATCH/DELETE | `/api/v1/admin/services/[id]` | Single service |
| GET/POST | `/api/v1/admin/packages` | Package CRUD |
| GET/PATCH/DELETE | `/api/v1/admin/packages/[id]` | Single package |
| GET/POST | `/api/v1/admin/add-ons` | Add-on CRUD |
| GET/POST | `/api/v1/admin/appointments` | All appointments |
| GET/PATCH | `/api/v1/admin/appointments/[id]` | Single appointment |
| PATCH | `/api/v1/admin/appointments/[id]/status` | Change status |
| PATCH | `/api/v1/admin/appointments/[id]/assign` | Assign worker |
| GET | `/api/v1/public/services` | Public service list |
| GET | `/api/v1/public/services/[slug]` | Public service detail |
| GET | `/api/v1/public/packages` | Public packages |
| GET | `/api/v1/public/slots` | Available slots query |
| GET/POST | `/api/v1/customer/appointments` | Customer book / list |
| GET | `/api/v1/customer/appointments/[id]` | Booking detail |
| POST | `/api/v1/customer/appointments/[id]/reschedule` | Customer reschedule |
| POST | `/api/v1/customer/appointments/[id]/cancel` | Customer cancel |
| GET/POST | `/api/v1/reception/appointments` | Walk-in booking + today list |
| POST | `/api/v1/reception/appointments/[id]/checkin` | Check-in customer |
| PATCH | `/api/v1/reception/appointments/[id]/assign` | Reassign worker |
| GET | `/api/v1/worker/appointments` | Worker's appointments |
| GET | `/api/v1/worker/appointments/[id]` | Single appointment |
| POST | `/api/v1/worker/appointments/[id]/start` | Start service |
| POST | `/api/v1/worker/appointments/[id]/complete` | Complete service |
| POST | `/api/v1/worker/appointments/[id]/reschedule` | Request reschedule |

**Slot logic you must implement:**  
Query `BranchTiming` for the day → generate 30-min slots → subtract existing confirmed appointments for that worker → subtract `WorkerAvailability` blocks → return free slots.

---

### Shalmon — `dev/shalmon`
**Your files only:**
```
app/api/v1/auth/**
app/api/v1/admin/invoices/**
app/api/v1/admin/inventory/**
app/api/v1/admin/memberships/**
app/api/v1/admin/coupons/**
app/api/v1/admin/campaigns/**
app/api/v1/admin/offers/**
app/api/v1/admin/gift-cards/**
app/api/v1/admin/reviews/**
app/api/v1/admin/reports/**
app/api/v1/reception/billing/**
app/api/v1/customer/membership/**
app/api/v1/customer/wallet/**
app/api/v1/customer/loyalty/**
app/api/v1/customer/reviews/**
app/api/v1/customer/gift-cards/**
app/api/v1/public/offers/**
```

**Your APIs to implement:**

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Email/password login |
| POST | `/api/v1/auth/otp/send` | Send OTP to phone/email |
| POST | `/api/v1/auth/otp/verify` | Verify OTP, issue JWT cookie |
| POST | `/api/v1/auth/logout` | Clear cookie |
| GET | `/api/v1/auth/me` | Current user profile |
| GET | `/api/v1/admin/invoices` | All invoices (paginated) |
| GET/PATCH | `/api/v1/admin/invoices/[id]` | Single invoice |
| POST | `/api/v1/admin/invoices/[id]/refund` | Issue refund |
| POST | `/api/v1/reception/billing` | Generate invoice from appointment |
| POST | `/api/v1/reception/billing/[id]/payment` | Record payment |
| GET/POST | `/api/v1/admin/inventory/products` | Products |
| GET/PATCH/DELETE | `/api/v1/admin/inventory/products/[id]` | Single product |
| GET | `/api/v1/admin/inventory/stock` | Stock per branch |
| GET/POST | `/api/v1/admin/inventory/purchases` | Purchase orders |
| GET/PATCH | `/api/v1/admin/inventory/purchases/[id]` | Receive stock |
| GET/POST | `/api/v1/admin/inventory/transfers` | Stock transfers |
| GET/POST | `/api/v1/admin/memberships/plans` | Plans |
| GET/PATCH/DELETE | `/api/v1/admin/memberships/plans/[id]` | Single plan |
| GET/POST | `/api/v1/customer/membership` | Customer's membership |
| GET | `/api/v1/customer/wallet` | Wallet balance |
| POST | `/api/v1/customer/wallet/topup` | Top up |
| GET | `/api/v1/customer/loyalty` | Loyalty account |
| POST | `/api/v1/customer/loyalty/redeem` | Redeem points |
| GET/POST | `/api/v1/admin/coupons` | Coupons |
| GET/PATCH/DELETE | `/api/v1/admin/coupons/[id]` | Single coupon |
| GET/POST | `/api/v1/admin/campaigns` | Campaigns |
| GET/PATCH | `/api/v1/admin/campaigns/[id]` | Single campaign |
| GET/POST | `/api/v1/admin/offers` | Offers |
| GET/PATCH/DELETE | `/api/v1/admin/offers/[id]` | Single offer |
| GET | `/api/v1/public/offers` | Public offers |
| GET/POST | `/api/v1/admin/gift-cards` | Gift cards |
| GET/PATCH | `/api/v1/admin/gift-cards/[id]` | Single gift card |
| GET/POST | `/api/v1/customer/gift-cards` | Customer gift cards |
| GET | `/api/v1/admin/reviews` | All reviews |
| POST | `/api/v1/admin/reviews/[id]/approve` | Approve review |
| POST | `/api/v1/admin/reviews/[id]/reject` | Reject review |
| GET/POST | `/api/v1/customer/reviews` | Customer reviews |
| GET | `/api/v1/admin/reports/revenue` | Revenue report |
| GET | `/api/v1/admin/reports/workers` | Worker report |
| GET | `/api/v1/admin/reports/inventory` | Inventory report |
| GET | `/api/v1/admin/reports/appointments` | Appointment stats |

---

### Devanshi — `dev/devanshi`
**Your files only:**
```
app/(public)/**
app/(customer)/**
app/login/page.tsx
app/unauthorized/page.tsx
components/public/**
components/customer/**
```

**Your pages to build:**

| Path | Page |
|---|---|
| `/` | Homepage (all sections) |
| `/services` | Services listing |
| `/services/[slug]` | Service detail |
| `/branches` | Branches listing |
| `/branches/[slug]` | Branch detail |
| `/stylists` | Stylists listing |
| `/stylists/[id]` | Stylist profile |
| `/packages` | Packages |
| `/gallery` | Gallery |
| `/offers` | Offers |
| `/book` | Booking flow (multi-step) |
| `/blog` | Blog listing |
| `/blog/[slug]` | Blog post |
| `/contact` | Contact |
| `/login` | Login (OTP + email) |
| `/customer/dashboard` | Customer dashboard |
| `/customer/bookings` | Booking history |
| `/customer/bookings/[id]` | Booking detail |
| `/customer/wallet` | Wallet |
| `/customer/membership` | Membership |
| `/customer/loyalty` | Loyalty points |
| `/customer/profile` | Profile |
| `/customer/reviews` | My reviews |
| `/customer/gift-cards` | Gift cards |

**Frontend approach — hardcoded first:**
Build all pages with static/hardcoded data initially. Do not wire real API calls yet — that happens in Phase 2 once Shalmon's auth routes are live. Use realistic dummy data so layouts and components look real.

When Phase 2 begins, replace hardcoded data with:
```typescript
import { API } from "@/lib/endpoints";
import type { ApiResponse } from "@/types/api";

const res = await fetch(API.public.branches);
const json: ApiResponse<Branch[]> = await res.json();
```

---

### Hemant — `dev/hemant`
**Your files only:**
```
app/(worker)/**
app/(reception)/**
app/(branch-admin)/**
app/(super-admin)/**
components/worker/**
components/reception/**
components/branch-admin/**
components/super-admin/**
```

**Your pages to build:**

| Path | Page |
|---|---|
| `/worker/dashboard` | Worker dashboard |
| `/worker/bookings` | Today/upcoming bookings |
| `/worker/bookings/[id]` | Booking detail + actions |
| `/worker/attendance` | Clock in/out |
| `/worker/leaves` | Leave requests |
| `/worker/portfolio` | Portfolio |
| `/reception/dashboard` | Reception dashboard |
| `/reception/booking/new` | New walk-in booking |
| `/reception/checkin` | Customer check-in |
| `/reception/billing` | Invoice list |
| `/reception/billing/[id]` | POS billing |
| `/reception/queue` | Queue view |
| `/branch-admin/dashboard` | Branch dashboard |
| `/branch-admin/appointments` | Calendar view |
| `/branch-admin/workers` | Workers list |
| `/branch-admin/workers/[id]` | Worker detail |
| `/branch-admin/schedule` | Shift scheduler |
| `/branch-admin/inventory` | Branch stock |
| `/branch-admin/reviews` | Review moderation |
| `/branch-admin/reports` | Branch reports |
| `/super-admin/dashboard` | Global dashboard |
| `/super-admin/branches` | Branches table |
| `/super-admin/branches/[id]` | Branch detail |
| `/super-admin/workers` | All workers |
| `/super-admin/workers/[id]` | Worker detail |
| `/super-admin/services` | Services mgmt |
| `/super-admin/customers` | CRM table |
| `/super-admin/customers/[id]` | Customer detail |
| `/super-admin/memberships` | Membership plans |
| `/super-admin/inventory` | Inventory mgmt |
| `/super-admin/marketing` | Campaigns/coupons |
| `/super-admin/reviews` | Global reviews |
| `/super-admin/reports` | Analytics |
| `/super-admin/settings` | Platform settings |
| `/super-admin/cms` | CMS |
| `/super-admin/audit-logs` | Audit logs |

**Frontend approach — hardcoded first:**  
Same as Devanshi — build all panels with static/hardcoded data. Wire real API calls in Phase 2.

---

## Shared Files — Everyone reads, nobody modifies without team discussion

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema — changes need team alignment |
| `types/api.ts` | API response types — discuss before adding |
| `lib/response.ts` | `ok()`, `err()`, `paginated()` helpers |
| `lib/auth-guard.ts` | `requireAuth()` — Shalmon owns implementation |
| `lib/endpoints.ts` | All API paths — add if you add a new route |
| `lib/db.ts` | Prisma client singleton |
| `middleware.ts` | Route protection — Shalmon owns |
| `app/layout.tsx` | Root HTML shell — do not touch |
| `app/globals.css` | Global styles — design discussion required |

---

## How to avoid merge conflicts

1. **Never edit another person's files** — if you need something from their module, call the API
2. **Shared types** — add to `types/api.ts` only when necessary, keep PRs small
3. **New routes** — add the path constant to `lib/endpoints.ts` in your PR
4. **Prisma schema** — coordinate on `#schema-changes` Slack before modifying
5. **Pull before you push** — always `git pull origin main` before starting work each day
6. **Small PRs** — one feature per PR, not a week of work in one PR

## Branch merge order (to avoid conflicts)

1. `dev/shalmon` → `main` first (auth must be live before anything else)
2. `dev/aman` → `main` (branches/workers depend on auth)
3. `dev/gauransh` → `main` (bookings depend on branches/workers being done)
4. `dev/devanshi` → `main` (can merge anytime — frontend is hardcoded initially)
5. `dev/hemant` → `main` (can merge anytime — frontend is hardcoded initially)

---

## Environment Variables needed in `.env`

```
DATABASE_URL=           # Neon DB — already set
JWT_SECRET=             # Shalmon sets this (any long random string)
NEXT_PUBLIC_APP_URL=    # Your deployment URL
RAZORPAY_KEY_ID=        # Shalmon sets when implementing payments
RAZORPAY_KEY_SECRET=    # Shalmon
WHATSAPP_API_TOKEN=     # Shalmon sets when implementing notifications
RESEND_API_KEY=         # Shalmon (email)
CLOUDFLARE_ACCOUNT_ID=  # For R2 file uploads (Aman — portfolio upload)
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
```
