# YardFlow — Deployment Guide
## Supabase + Vercel Setup (Step by Step)

---

## Overview

This guide walks you through deploying YardFlow as a live web app your team can use on any device. The stack:

- **Frontend**: React (Vite) — the app your team sees
- **Backend**: Supabase — database, authentication, real-time sync
- **Hosting**: Vercel — free, instant deploy, gives you a URL

**Time estimate**: ~45 minutes for someone comfortable with websites, ~90 minutes if this is new to you.

---

## Step 1: Create a Supabase Project (5 min)

1. Go to **https://supabase.com** and click "Start your project"
2. Sign up with GitHub (easiest) or email
3. Click **"New Project"**
4. Fill in:
   - **Name**: `yardflow`
   - **Database Password**: Pick something strong, save it somewhere safe
   - **Region**: Choose the one closest to your plant
5. Click **"Create new project"** — wait ~2 minutes for it to spin up

### Get your keys:
1. In your Supabase dashboard, go to **Settings → API**
2. Copy these two values (you'll need them later):
   - **Project URL** — looks like `https://abc123xyz.supabase.co`
   - **anon/public key** — a long string starting with `eyJ...`

---

## Step 2: Create the Database Tables (10 min)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Paste the ENTIRE contents of the file **`supabase/schema.sql`** (included in this project)
4. Click **"Run"**
5. You should see "Success" — this creates all your tables, indexes, security policies, and seeds your admin user

### What gets created:
| Table | Purpose |
|-------|---------|
| `users` | All user accounts (admin, managers, warehouse, hostlers) |
| `trailers` | Trailer inventory with type, status, location |
| `moves` | Move requests and completion log |
| `locations` | Docks, yard spots, gates |

---

## Step 3: Set Up the Frontend (10 min)

### Option A: If you have Node.js installed
```bash
# Clone or download this project folder
cd yardflow

# Install dependencies
npm install

# Create your environment file
cp .env.example .env

# Edit .env and paste your Supabase URL and key
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...your-key...

# Start the dev server
npm run dev
```
Open http://localhost:5173 — you should see the login screen.

### Option B: If you don't have Node.js
1. Install Node.js from https://nodejs.org (pick the LTS version)
2. Restart your terminal/command prompt
3. Follow Option A above

---

## Step 4: Deploy to Vercel (10 min)

1. Go to **https://vercel.com** and sign up with GitHub
2. Push your yardflow folder to a GitHub repository:
   ```bash
   cd yardflow
   git init
   git add .
   git commit -m "YardFlow initial deploy"
   # Create a repo on GitHub, then:
   git remote add origin https://github.com/YOUR-USERNAME/yardflow.git
   git push -u origin main
   ```
3. In Vercel, click **"Import Project"** → select your GitHub repo
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**
6. In ~60 seconds you'll get a URL like `yardflow.vercel.app`

### Custom domain (optional):
In Vercel → Settings → Domains, you can add a custom domain like `yard.yourcompany.com`

---

## Step 5: Create User Accounts (5 min)

1. Open your deployed app URL
2. Log in as admin:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Go to **User Management** (👥 in sidebar)
4. Click **"+ Add User"** for each of your team members
5. Set their role:
   - **Hostler** — for your 8 drivers
   - **Warehouse** — for dock workers who request moves
   - **Manager** — for supervisors who need analytics
   - **Admin** — for IT/yourself

### ⚠️ Important: Change the admin password!
Go to User Management → click 🔑 on the admin account → set a real password.

---

## Step 6: Share with Your Team

Send your team the URL and their login credentials. The app works on:
- ✅ Desktop browsers (Chrome, Edge, Firefox, Safari)
- ✅ Phone browsers (Safari on iPhone, Chrome on Android)
- ✅ Tablets

### Pro tip: Add to Home Screen
On phones, users can tap "Add to Home Screen" in their browser menu — this makes YardFlow launch like a native app (full screen, icon on home screen).

---

## How Real-Time Sync Works

Supabase provides real-time subscriptions. When a warehouse user submits a move request, every hostler's screen updates within 1-2 seconds — no refresh needed. Same when a hostler claims or completes a move.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Invalid login" | Check username/password, make sure account is active |
| Page is blank | Check browser console (F12), verify .env has correct Supabase keys |
| Data not showing | Run the schema.sql again in Supabase SQL Editor |
| Real-time not working | Check Supabase dashboard → Realtime is enabled for your tables |
| Can't deploy | Make sure .env is NOT committed to git (it's in .gitignore) |

---

## File Structure

```
yardflow/
├── public/
├── src/
│   ├── lib/
│   │   └── supabase.js          ← Supabase client + all database functions
│   ├── components/
│   │   └── UI.jsx                ← Shared UI components (Badge, Card, Table, etc.)
│   ├── pages/
│   │   ├── Login.jsx             ← Login screen
│   │   ├── Dashboard.jsx         ← Manager dashboard
│   │   ├── Moves.jsx             ← Move request list
│   │   ├── Trailers.jsx          ← Trailer inventory
│   │   ├── YardMap.jsx           ← Visual yard/dock map
│   │   ├── HostlerView.jsx       ← Hostler claim & complete
│   │   ├── Analytics.jsx         ← Performance analytics
│   │   └── UserManagement.jsx    ← Admin user CRUD
│   ├── App.jsx                   ← Main app shell with routing
│   └── main.jsx                  ← Entry point
├── supabase/
│   └── schema.sql                ← Database schema + seed data
├── .env.example                  ← Environment variable template
├── package.json
├── vite.config.js
├── index.html
└── SETUP.md                      ← This file
```
