# NGO Hub

NGO Management Platform — built module by module.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL via **Supabase** (production) or local Postgres (development)
- Prisma ORM with `@prisma/adapter-pg`
- Custom JWT auth (httpOnly cookies) with refresh tokens
- Optional Supabase JS client for storage / realtime
- RBAC for roles: Admin, Manager, Accountant, HR, Coordinator, Staff

## Quick start (local)

### 1. Start the database

**Option A — Prisma local Postgres (recommended for dev):**

```bash
npx prisma dev
```

Keep this running. It updates `DATABASE_URL` in `.env` automatically.

**Option B — Your own PostgreSQL:**

Copy `.env.example` to `.env` and set `DATABASE_URL` and `DIRECT_DATABASE_URL`.

### 2. Apply schema and seed

```bash
npm run db:push
npm run db:seed
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ngohub.local | Admin@123 |
| Manager | manager@ngohub.local | Manager@123 |
| HR | hr@ngohub.local | Hr@123 |
| Coordinator | coordinator@ngohub.local | Coord@123 |
| Staff | staff@ngohub.local | Staff@123 |

## Production (Supabase)

### 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project
2. **Database → Network** → allow all IPs (`0.0.0.0/0`) so your host can connect
3. **Connect → Pooler → Session mode** (port **5432**) — copy the URI  
   User must be `postgres.[project-ref]`, not `postgres` alone
4. **Project Settings → API** — copy `URL` and `anon` key for optional JS client

### 2. Push schema and seed (from your machine)

```bash
npm run setup:production-db -- "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

This validates the connection, runs `prisma db push`, seeds demo users, and prints production env vars (with fresh JWT secrets).

Or print env vars only:

```bash
npm run print:production-env -- "<session-pooler-uri>" "https://your-domain.com"
```

### 3. Verify connectivity

```bash
# Postgres (set DATABASE_URL in .env first)
npm run check:database

# Supabase REST API (optional)
npm run check:supabase
```

Health endpoint after deploy: `GET /api/health`

## Progressive Web App (PWA)

NGO Hub can be installed on phones and tablets from the browser.

### What is included

- Web app manifest (`/manifest.webmanifest`) — home screen install, standalone mode
- Service worker (`/sw.js`) — caches static assets and shows `/offline` when navigation fails
- Install prompt on supported browsers (Chrome, Edge, Android)
- Works with the existing offline queue for field data sync

### Install on a phone

**Android (Chrome):** Open your deployed site → menu → **Install app** (or use the in-app install banner).

**iPhone (Safari):** Open the site → Share → **Add to Home Screen**.

### Local PWA testing

Service workers require HTTPS or `localhost`:

```bash
npm run dev
# open http://localhost:3000
```

Use Chrome DevTools → **Application** → **Manifest** / **Service Workers** to verify registration.

### Production requirements

- Site must be served over **HTTPS**
- `NEXT_PUBLIC_APP_URL` must match your public domain
- Deploy a fresh build after PWA changes so `/sw.js` updates on users' devices
- After changing `public/svitech-logo.png`, run `npm run generate:pwa-icons` locally and commit the updated files in `public/icons/` (production build does not regenerate icons)

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase session pooler URI (port 5432) |
| `DIRECT_DATABASE_URL` | Same as `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | Random secret (32+ bytes) |
| `JWT_REFRESH_SECRET` | Random secret (32+ bytes) |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `https://your-domain.com` |
| `NODE_ENV` | Set to `production` on Hostinger |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional — `https://[ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional — from Supabase API settings |

URL-encode special characters in the database password (`@` → `%40`, `#` → `%23`).

## Deploy on Hostinger (Node.js)

1. Push this repo to GitHub
2. Hostinger → **Websites** → **Add Website** → **Node.js** → import `vivekshelar08/NGOhub`
3. Use these **exact** deploy settings:

| Setting | Value |
|---------|--------|
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `next start -H 0.0.0.0 -p $PORT` |
| Node.js version | **20** |

Use the start command **exactly** as shown — do not use a wrapper script. Hostinger must run Next.js as the main process on `PORT`.

`npm run start` is equivalent when `PORT` is set by Hostinger.

4. Add **all** environment variables (required for build and runtime)

After the first deploy with password reset, run once from your machine (with production `DATABASE_URL`):

```bash
npx prisma db push
```
5. Deploy → **Runtime logs** should show `▲ Next.js` and `✓ Ready`

**Intermittent 503?** Hostinger stops idle Node apps. The app self-pings `/api/live` every 4 minutes; also set up a free [UptimeRobot](https://uptimerobot.com) monitor on `https://svitech.in/api/live` every 5 minutes. `/api/health` always returns HTTP 200 so a slow database does not trigger Hostinger's error page.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Rotate session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/health` | Database + Supabase health |
| GET | `/api/users` | List users (Admin) |
| POST | `/api/users` | Create user (Admin) |

## Roadmap

- Tab 2: Users & Organization
- Tab 3: Projects & Programs
- Tab 4: Beneficiaries
- Tab 5: Finance
- Tab 6: HR & Attendance
- Tab 7: Reports
