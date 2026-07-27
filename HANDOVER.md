# Renzo — Project Handover Guide

**Prepared by:** Corescent Development  
**For:** Renzo Hair & Beauty Studio  

> This document tells you exactly what accounts to create, what to save, and what it will cost. No technical knowledge needed — just follow the steps in order.

---

## What You're Getting

Your salon platform runs on **6 online services**. Think of them like different utility bills — each does one job, most are free to start, and you only pay more when your business grows.

| Service | What It Does | Monthly Cost to Start |
|---|---|---|
| **Domain** | Your website address (renzosalons.com) | ~₹800/year |
| **Vercel** | Runs your website | Free → ₹1,700/mo |
| **Neon** | Stores all your data (bookings, customers, staff) | Free → ₹1,600/mo |
| **Cloudflare** | Protects your website + stores photos | Free → pay as you grow |
| **Resend** | Sends emails to customers and staff | Free → ₹1,700/mo |
| **Google** | "Sign in with Google" for customers | Free |

**Total at launch: ₹0–₹800/year** (just the domain). Everything else is free until you grow.

---

## Why Not AWS?

You may have heard of Amazon AWS. Here's the honest comparison:

| | Vercel + Our Stack | AWS |
|---|---|---|
| **Monthly cost at your scale** | ~₹0–1,700 | ₹7,000–12,000 minimum |
| **Setup time** | 1 day | 1–2 weeks |
| **Needs a technical person to manage** | No | Yes (₹50k+/mo salary) |
| **Scales as you grow** | Yes, automatically | Yes, but manually |
| **Can migrate to AWS later if needed** | Yes, easily | — |

**Verdict:** AWS is built for large corporations with dedicated tech teams. Our stack gives you the same reliability at a fraction of the cost. If your business grows to 50,000+ bookings per month, we can migrate — but that's a good problem to have.

---

## Step-by-Step Setup

### Step 1 — Buy Your Domain (~15 minutes)

Your domain is your website address, like `renzosalons.com`.

1. Go to **namecheap.com** (recommended — simple and affordable)
2. Search for your preferred name (e.g. `renzosalons.com`)
3. Add to cart and purchase — costs about ₹800–1,200 per year
4. Create an account with your business email during checkout

> **Save:** Namecheap login email + password

---

### Step 2 — Set Up Cloudflare (Free, ~10 minutes)

Cloudflare sits between the internet and your website. It keeps it fast, safe, and handles your photos.

1. Go to **cloudflare.com** → Sign Up (free)
2. Click **Add a Site** → type your domain → choose Free plan
3. Cloudflare will show you 2 "nameservers" — copy them
4. Go back to Namecheap → log in → find your domain → change nameservers to Cloudflare's
5. Back in Cloudflare → click **R2 Object Storage** in the left menu → **Create Bucket** → name it `renzo-media` → Create
6. Open the bucket → **Settings** → **Public Access** → Enable
7. Go to **My Profile** → **API Tokens** → **Create Token** → choose "Edit Cloudflare Workers" template → Create → **copy the token shown (it won't show again)**

> **Save:** Cloudflare email + password, API token, bucket URL (shown after enabling public access)

---

### Step 3 — Set Up the Database (Free, ~10 minutes)

This is where all your bookings, customers, staff and appointments are stored securely.

1. Go to **neon.tech** → Sign Up (free)
2. Click **New Project** → name it `renzo-production` → Create
3. On the dashboard, find the **Connection String** — it starts with `postgresql://` — copy the whole thing

> **Save:** Neon email + password, connection string (treat like a password — keep it private)

---

### Step 4 — Set Up Email (Free, ~15 minutes)

This sends booking confirmations, OTP codes, and staff welcome emails.

1. Go to **resend.com** → Sign Up (free)
2. Click **Domains** → **Add Domain** → type `mail.renzosalons.com` → Add
3. Resend shows you some DNS records — copy them into Cloudflare (add them as DNS records in your Cloudflare dashboard)
4. Click **Verify** in Resend → wait 5 minutes → Verified ✓
5. Go to **API Keys** → **Create API Key** → name it `renzo-production` → copy the key

> **Save:** Resend email + password, API key (starts with `re_`)

---

### Step 5 — Set Up Google Sign-In (Free, ~20 minutes)

Lets customers log in with their Google account — no password needed for them.

1. Go to **console.cloud.google.com** → sign in with a Google account
2. Click the project dropdown at top → **New Project** → name it `Renzo` → Create
3. Left menu → **APIs & Services** → **OAuth consent screen** → External → fill in:
   - App name: `Renzo`
   - Support email: your email
   - Click Save
4. Left menu → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: Web Application
   - Name: `Renzo Web`
   - Authorised JavaScript origins: `https://renzosalons.com`
   - Click Create
5. Copy the **Client ID** shown (long string ending in `.apps.googleusercontent.com`)

> **Save:** Google account email + password, Client ID

---

### Step 6 — Set Up Hosting on Vercel (Free to start, ~20 minutes)

This is where your website actually runs.

1. Go to **vercel.com** → Sign Up with your email
2. Click **Add New Project** → Import your GitHub repository
3. Before clicking Deploy, click **Environment Variables** and add all the values from the table below
4. Click **Deploy** — Vercel builds and launches your site automatically
5. Once deployed, go to **Domains** → Add your domain → follow the instructions

> **Save:** Vercel email + password

---

## Environment Variables (Copy-Paste List)

When Vercel asks for environment variables, add each of these. The values on the right come from the accounts you created above.

```
DATABASE_URL         → paste the Neon connection string
JWT_SECRET           → any 64-character random text (use passwordsgenerator.net)

GOOGLE_CLIENT_ID              → paste the Google Client ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID  → same Google Client ID (paste it twice)

R2_ACCOUNT_ID        → your Cloudflare Account ID (top-right of Cloudflare dashboard)
R2_BUCKET_NAME       → renzo-media
R2_ACCESS_KEY_ID     → from Cloudflare API token page
R2_SECRET_ACCESS_KEY → from Cloudflare API token page
R2_PUBLIC_URL        → the public bucket URL from Cloudflare R2

SMTP_HOST            → smtp.resend.com
SMTP_PORT            → 465
SMTP_USER            → resend
SMTP_PASS            → paste the Resend API key
SMTP_FROM            → Renzo <noreply@renzosalons.com>

GROQ_API_KEY         → (Corescent will provide this)
NODE_ENV             → production
```

---

## Creating Your First Admin Login

After Vercel finishes deploying, tell your developer to run the admin setup script. They'll create your super admin account with:

- **Login page:** `https://renzosalons.com/staff/login`
- **Email:** whatever you choose
- **Password:** set by you, change it after first login

From there you can create branch admins and staff directly inside the platform.

---

## What Happens When You Grow

No action needed from you — just upgrade the plan on the relevant service. Your website keeps running without any downtime.

| Stage | Approx. Bookings/Month | Estimated Monthly Cost |
|---|---|---|
| Just launched | Up to 2,000 | ₹0 (free tiers) |
| Growing | 2,000–20,000 | ₹3,000–5,000 |
| Established | 20,000–100,000 | ₹7,000–10,000 |
| Large chain | 100,000+ | Custom — we plan together |

---

## Your Credentials Summary

Fill this in and store it somewhere safe (a password manager like **1Password** or **Bitwarden** is ideal). Do not share these over WhatsApp or email.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RENZO PLATFORM — ACCOUNT CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOMAIN (Namecheap)
  Website:   namecheap.com
  Email:     ____________________________
  Password:  ____________________________
  Domain:    ____________________________

WEBSITE HOSTING (Vercel)
  Website:   vercel.com
  Email:     ____________________________
  Password:  ____________________________

DATABASE (Neon)
  Website:   console.neon.tech
  Email:     ____________________________
  Password:  ____________________________
  ⚠ Connection string stored separately

SECURITY + PHOTOS (Cloudflare)
  Website:   dash.cloudflare.com
  Email:     ____________________________
  Password:  ____________________________

EMAIL (Resend)
  Website:   resend.com
  Email:     ____________________________
  Password:  ____________________________

GOOGLE (Customer Sign-In)
  Website:   console.cloud.google.com
  Email:     ____________________________
  Password:  ____________________________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PLATFORM ADMIN LOGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URL:       https://[yourdomain]/staff/login
  Email:     ____________________________
  Password:  ____________________________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Go-Live Checklist

Tick each one before announcing to customers:

- [ ] Domain purchased
- [ ] Cloudflare set up, nameservers updated
- [ ] Neon database created
- [ ] Resend email verified and working
- [ ] Google sign-in set up
- [ ] All credentials entered in Vercel
- [ ] Website live at your domain with green padlock (SSL)
- [ ] Super admin account created and working
- [ ] Test booking made and confirmation email received
- [ ] Staff photo upload tested

---

*Prepared by Corescent Development · Keep this document private*
